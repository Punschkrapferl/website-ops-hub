import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";
import { openDb } from "./db.js";
import { corsMiddleware } from "./middleware/cors.js";

import { healthRouter } from "./routes/health.js";
import { eventsRouter } from "./routes/events.js";
import { adminRouter } from "./routes/admin.js";
import { leadRouter } from "./routes/leads.js";

export function createApp() {
    const app = express();

    // Order matters: CORS → body → logging → routes
    app.use(corsMiddleware);
    app.use(express.json({ limit: "1mb" }));
    app.use(pinoHttp({ logger }));

    let db;
    try {
        db = openDb(process.env.DB_PATH ?? "./app.db");
    } catch (err) {
        logger.fatal(err, "Failed to open database");
        process.exit(1);
    }

    app.use(healthRouter);
    app.use(eventsRouter(db));
    app.use(adminRouter(db));
    app.use(leadRouter(db));

    return app;
}
