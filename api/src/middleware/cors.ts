import type { Request, Response, NextFunction } from "express";

const ALLOWED_ORIGINS = new Set(
    (process.env.CORS_ORIGIN ?? "")
        .split(",")
        .map(o => o.trim())
        .filter(Boolean)
);

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Idempotency-Key, X-Admin-Token"
        );
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
}
