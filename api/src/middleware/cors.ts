// CORS: allows cross-origin requests only from explicitly whitelisted origins.
// Required when frontend runs on a different port (e.g. :4567 → :8080).

import type { Request, Response, NextFunction } from "express";

// Allowed origins loaded from env (comma-separated)
const ALLOWED_ORIGINS = new Set(
    (process.env.CORS_ORIGIN ?? "")
        .split(",")
        .map(o => o.trim())
        .filter(Boolean)
);

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    // Apply CORS headers only for explicitly allowed origins
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin"); // required to avoid cache poisoning
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Idempotency-Key, X-Admin-Token"
        );
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    }

    // Short-circuit preflight requests
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
}
