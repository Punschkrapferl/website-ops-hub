import type { Request, Response, NextFunction } from "express";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!ADMIN_TOKEN) {
        return res.status(404).json({ ok: false });
    }

    if (req.header("X-Admin-Token") !== ADMIN_TOKEN) {
        return res.status(401).json({ ok: false });
    }

    next();
}
