import type { Request, Response, NextFunction } from "express";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Simple shared-secret admin auth for destructive routes.
// Intentionally fails hard if ADMIN_TOKEN is not configured.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {

    // Fail fast if server is misconfigured
    if (!ADMIN_TOKEN) {
        req.log?.error("ADMIN_TOKEN is not configured");
        return res.status(500).json({ ok: false });
    }

    // Simple shared-secret admin auth
    if (req.header("X-Admin-Token") !== ADMIN_TOKEN) {
        return res.status(401).json({ ok: false });
    }

    next();
}
