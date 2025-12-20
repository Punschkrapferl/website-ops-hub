// Lead ingestion endpoint with idempotency + transactional event logging.

import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import type { Db } from "../db.js";

import {
    insertEvent,
    getLeadByIdempotencyKey,
    EVENT_TYPES,
} from "../db.js";
import { mockCrmUpsert, mockNotify } from "../integrations.js";

// Request validation and normalization
const LeadSchema = z.object({
    name: z.string().trim().min(1).max(120).optional().or(z.literal("")),
    email: z.string().trim().email().max(200),
    company: z.string().trim().max(200).optional().or(z.literal("")),
    message: z.string().trim().max(5000).optional().or(z.literal("")),
});

// Normalize optional strings to null for DB storage
function normalizeOpt(s?: string): string | null {
    const v = (s ?? "").trim();
    return v.length ? v : null;
}

// Idempotency via header or deterministic hash fallback
function getIdempotencyKey(req: any, email: string): string {
    const hdr = req.header("Idempotency-Key");
    if (hdr && hdr.length <= 200) return hdr;

    const msg = (req.body?.message ?? "").toString();

    return crypto
        .createHash("sha256")
        .update(`${email}::${msg}`)
        .digest("hex")
        .slice(0, 64);
}

export function leadRouter(db: Db) {
    const router = Router();

    // Prepared statement reused inside transaction
    const insertLeadStmt = db.prepare(`
    INSERT INTO leads (idempotency_key, name, email, company, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    // Atomic lead creation + event logging
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
        insertEvent(db, leadId, EVENT_TYPES.LEAD_RECEIVED, "ok");
        return leadId;
    });

    router.post("/api/lead", (req, res) => {
        const parsed = LeadSchema.safeParse(req.body);
        if (!parsed.success) {
            insertEvent(db, null, EVENT_TYPES.LEAD_RECEIVED, "error");
            return res.status(400).json({ ok: false });
        }

        const data = parsed.data;
        const email = data.email.toLowerCase();
        const idempotencyKey = getIdempotencyKey(req, email);
        const createdAt = new Date().toISOString();

        try {
            const leadId = createLeadTx({
                idempotencyKey,
                name: normalizeOpt(data.name),
                email,
                company: normalizeOpt(data.company),
                message: normalizeOpt(data.message),
                createdAt,
            });

            const lead = {
                id: leadId,
                email,
                name: normalizeOpt(data.name),
                company: normalizeOpt(data.company),
                message: normalizeOpt(data.message),
            };

            // Fire-and-forget integrations (non-critical path)
            try {
                mockCrmUpsert(db, lead);
                mockNotify(db, lead);
            } catch {}

            (req as any).log?.info({ leadId, email }, "lead created");
            res.status(201).json({ ok: true, leadId });
        } catch (err: any) {
            // Idempotent retry handling
            if (String(err?.message).includes("UNIQUE")) {
                const existing = getLeadByIdempotencyKey(db, idempotencyKey);
                (req as any).log?.info(
                    { leadId: existing?.id, email },
                    "duplicate lead submission"
                );
                return res.json({ ok: true, duplicate: true, leadId: existing?.id });
            }

            (req as any).log?.error({ err }, "lead ingestion failed");
            res.status(500).json({ ok: false });
        }
    });

    return router;
}
