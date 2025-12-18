import type { Db } from "./db.js";
import { insertEvent } from "./db.js";

export type Lead = {
    id: number;
    name: string | null;
    email: string;
    company: string | null;
    message: string | null;
};

export function mockCrmUpsert(db: Db, lead: Lead) {
    // Pretend we called a CRM. In reality, we just log an event.
    insertEvent(db, lead.id, "crm_upsert", "ok", `Upserted contact for ${lead.email}`);
}

export function mockNotify(db: Db, lead: Lead) {
    // Pretend we notified marketing/ops via Slack/email.
    insertEvent(db, lead.id, "notify", "ok", `Notified ops about lead ${lead.email}`);
}
