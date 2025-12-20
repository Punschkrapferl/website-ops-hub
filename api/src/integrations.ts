import type { Db } from "./db.js";
import { insertEvent, EVENT_TYPES } from "./db.js";

// Pretty logs in dev, structured logs in production
export type Lead = {
    id: number;
    name: string | null;
    email: string;
    company: string | null;
    message: string | null;
};

// Mock integrations to keep API self-contained (no external dependencies)
export function mockCrmUpsert(db: Db, lead: Lead) {
    // Pretend we called a CRM. In reality, we just log an event.
    insertEvent(db, lead.id, EVENT_TYPES.CRM_UPSERT, "ok", `Upserted contact for ${lead.email}`);
}

export function mockNotify(db: Db, lead: Lead) {
    // Pretend we notified marketing/ops via Slack/email.
    insertEvent(db, lead.id, EVENT_TYPES.NOTIFY, "ok", `Notified ops about lead ${lead.email}`);
}
