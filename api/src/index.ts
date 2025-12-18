import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { z } from "zod";
import {
    openDb,
    insertEvent,
    getLeadByIdempotencyKey,
    listEvents,
    clearEvents,
    resetDemo,
} from "./db.js";
import { mockCrmUpsert, mockNotify } from "./integrations.js";

const logger = pino({ level: process.env.NODE_ENV === "production" ? "info" : "debug" });

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN;

if (CORS_ORIGIN) {
    app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
        res.setHeader("Vary", "Origin");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Idempotency-Key, X-Admin-Token"
        );
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
        if (req.method === "OPTIONS") return res.sendStatus(204);
        next();
    });
}

app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

const dbPath = process.env.DB_PATH ?? "./app.db";
const db = openDb(dbPath);

const LeadSchema = z.object({
    name: z.string().trim().min(1).max(120).optional().or(z.literal("")),
    email: z.string().trim().email().max(200),
    company: z.string().trim().max(200).optional().or(z.literal("")),
    message: z.string().trim().max(5000).optional().or(z.literal("")),
});

function normalizeOpt(s: string | undefined): string | null {
    const v = (s ?? "").trim();
    return v.length ? v : null;
}

function getIdempotencyKey(req: express.Request, email: string): string {
    const hdr = req.header("Idempotency-Key");
    if (hdr && hdr.length <= 200) return hdr;

    const msg = (req.body?.message ?? "").toString();
    return `${email}::${msg}`.slice(0, 200);
}

const insertLeadStmt = db.prepare(`
  INSERT INTO leads (idempotency_key, name, email, company, message, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const createLeadTx = db.transaction((params: {
    idempotencyKey: string;
    name: string | null;
    email: string;
    company: string | null;
    message: string | null;
    createdAt: string;
}) => {
    const info = insertLeadStmt.run(
        params.idempotencyKey,
        params.name,
        params.email,
        params.company,
        params.message,
        params.createdAt
    );
    const leadId = Number(info.lastInsertRowid);

    insertEvent(db, leadId, "lead_received", "ok");
    return leadId;
});

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/events", (req, res) => {
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);
    const events = listEvents(db, limit);
    res.json({ events });
});

// ---- Admin-protected endpoints ----
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    // If not setting a token, admin endpoints are disabled.
    if (!ADMIN_TOKEN) return res.status(404).json({ ok: false });

    const token = req.header("X-Admin-Token");
    if (token !== ADMIN_TOKEN) return res.status(401).json({ ok: false });

    next();
}

// Clear ONLY the events feed.
app.delete("/api/events", requireAdmin, (req, res) => {
    const vacuum = (req.query.vacuum as string) === "1";
    const deleted = clearEvents(db, vacuum);
    res.json({ ok: true, deleted });
});

// Reset the whole demo: wipe leads + events.
app.post("/api/admin/reset", requireAdmin, (req, res) => {
    const vacuum = (req.query.vacuum as string) === "1";
    const result = resetDemo(db, vacuum);
    res.json({ ok: true, ...result });
});

app.post("/api/lead", (req, res) => {
    const parsed = LeadSchema.safeParse(req.body);
    if (!parsed.success) {
        insertEvent(db, null, "lead_received", "error", JSON.stringify(parsed.error.flatten()));
        return res.status(400).json({
            ok: false,
            error: "Invalid payload",
            details: parsed.error.flatten(),
        });
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();
    const idempotencyKey = getIdempotencyKey(req, email);
    const createdAt = new Date().toISOString();

    const name = normalizeOpt(data.name as any);
    const company = normalizeOpt(data.company as any);
    const message = normalizeOpt(data.message as any);

    try {
        const leadId = createLeadTx({
            idempotencyKey,
            name,
            email,
            company,
            message,
            createdAt,
        });

        const lead = { id: leadId, name, email, company, message };

        try {
            mockCrmUpsert(db, lead);
        } catch (e: any) {
            insertEvent(db, leadId, "crm_upsert", "error", String(e?.message ?? e));
        }

        try {
            mockNotify(db, lead);
        } catch (e: any) {
            insertEvent(db, leadId, "notify", "error", String(e?.message ?? e));
        }

        return res.status(201).json({ ok: true, leadId });
    } catch (err: any) {
        const msg = String(err?.message ?? err);

        if (msg.includes("UNIQUE")) {
            const existing = getLeadByIdempotencyKey(db, idempotencyKey);
            const existingId = existing?.id ?? null;

            insertEvent(db, existingId, "lead_received", "duplicate", `Idempotency-Key=${idempotencyKey}`);
            return res.status(200).json({ ok: true, duplicate: true, leadId: existingId });
        }

        insertEvent(db, null, "lead_received", "error", msg);
        return res.status(500).json({ ok: false, error: "Server error" });
    }
});

const port = 8080;
app.listen(port, () => {
    logger.info({ port, dbPath }, "API listening");
});
