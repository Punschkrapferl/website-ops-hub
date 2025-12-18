import type { Request, Response, NextFunction } from "express";

const CORS_ORIGIN = process.env.CORS_ORIGIN;

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!CORS_ORIGIN) return next();

    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
    res.setHeader("Vary", "Origin");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Idempotency-Key, X-Admin-Token"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
}
