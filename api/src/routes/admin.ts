import { Router } from "express";
import type { Db } from "../db.js";
import { clearEvents, resetDemo } from "../db.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

// Admin-only routes for demo / ops use (data deletion, reset).
export function adminRouter(db: Db) {
    const router = Router();

    router.delete("/api/events", requireAdmin, (req, res) => {
        // Optional VACUUM for SQLite compaction
        const vacuum = (req.query.vacuum as string) === "1";
        const deleted = clearEvents(db, vacuum);
        res.json({ ok: true, deleted });
    });

    router.post("/api/admin/reset", requireAdmin, (req, res) => {
        const vacuum = (req.query.vacuum as string) === "1";
        const result = resetDemo(db, vacuum);
        res.json({ ok: true, ...result });
    });

    return router;
}
