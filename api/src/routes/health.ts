import { Router } from "express";

export const healthRouter = Router();

// Lightweight health probe (no caching)
healthRouter.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true });
});
