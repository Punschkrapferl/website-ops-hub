import { Router } from "express";
import type { Db } from "../db.js";
import { listEvents } from "../db.js";

export function eventsRouter(db: Db) {
    const router = Router();

    router.get("/api/events", (req, res) => {
        const limit = Math.min(
            parseInt((req.query.limit as string) ?? "50", 10) || 50,
            200
        );

        res.json({ events: listEvents(db, limit) });
    });

    return router;
}
