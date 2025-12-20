/* eslint-env browser, es2021 */
/* global window,
  document,
  fetch,
  console,
  Error,
  JSON,
  Math,
  String,
  Boolean
*/

// Demo: nginx proxies /api (same-origin).
// Dev: Middleman runs on :4567, so we call the API directly on :8080 (CORS required).

const API_BASE = (() => {
    const port = window.location.port;
    return port === "4567" ? "http://localhost:8080" : "";
})();

const EVENTS_LIST_URL = `${API_BASE}/api/events?limit=8`;
const RESET_URL = `${API_BASE}/api/admin/reset`;
const HEALTH_URL = `${API_BASE}/health`;

const ADMIN_TOKEN =
    document.querySelector('meta[name="admin-token"]')?.getAttribute("content") ?? "";

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // If server ever returns non-JSON, treat it as failure.
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
        throw new Error(`Expected JSON but got: ${ct || "unknown content-type"}`);
    }

    return res.json();
}

async function postJson(url, opts = {}) {
    const headers = {
        Accept: "application/json",
        ...(opts.headers || {}),
    };

    const res = await fetch(url, {
        method: "POST",
        headers,
        cache: "no-store",
    });

    // No redundant init; parse if possible, otherwise null.
    let data = null;
    try {
        data = await res.json();
    } catch {

    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return data;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setBadge(id, ok, textOk, textFail) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `badge ${ok ? "text-bg-success" : "text-bg-danger"} rounded-pill`;
    el.textContent = ok ? textOk : textFail;
}

/**
 * Mask emails in any text so you don't casually leak them in the event feed.
 * Example: "sin.in@gmail.com" -> "s****n@gmail.com"
 */
const EMAIL_RE = /\b([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+\.[A-Z]{2,63})\b/gi;

function maskEmail(email) {
    const at = email.indexOf("@");
    if (at <= 0) return email;

    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    if (!domain) return email;

    // No redundant init + overwrite; compute directly.
    const maskedLocal =
        local.length <= 2
            ? local[0] + "*".repeat(Math.max(1, local.length - 1))
            : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];

    return `${maskedLocal}@${domain}`;
}

function redactEmailsInText(text) {
    if (!text) return text;
    return String(text).replace(EMAIL_RE, (m) => maskEmail(m));
}

function renderEvents(listEl, events) {
    if (!listEl) return;
    listEl.innerHTML = "";

    if (!events || events.length === 0) {
        listEl.innerHTML = `<div class="muted">No events yet. Submit a lead to generate some.</div>`;
        return;
    }

    for (const ev of events) {
        const type = ev.type ?? "event";
        const status = ev.status ?? "unknown";
        const t = ev.created_at ?? "";
        const detailRaw = ev.detail ? String(ev.detail) : "";
        const detail = redactEmailsInText(detailRaw);

        const row = document.createElement("div");
        row.className = "event-row";
        row.innerHTML = `
      <div>
        <div class="d-flex align-items-center gap-2">
          <span class="badge badge-soft">${type}</span>
          <span class="badge badge-soft">${status}</span>
        </div>
        ${detail ? `<div class="muted small mt-1">${detail}</div>` : ""}
      </div>
      <div class="muted small text-end">${t}</div>
    `;
        listEl.appendChild(row);
    }
}

async function loadStatusAndEvents() {
    // health
    try {
        const health = await fetchJson(HEALTH_URL);
        setBadge("healthBadge", Boolean(health?.ok), "Healthy", "Unhealthy");
    } catch {
        setBadge("healthBadge", false, "Healthy", "Unreachable");
    }

    // events
    try {
        const data = await fetchJson(EVENTS_LIST_URL);
        const events = data?.events ?? [];
        setText("eventsCount", String(events.length));
        if (events[0]?.created_at) setText("lastEventTime", events[0].created_at);
        renderEvents(document.getElementById("eventsList"), events);
    } catch {
        setText("eventsCount", "0");
        setText("lastEventTime", "n/a");
        const listEl = document.getElementById("eventsList");
        if (listEl) listEl.innerHTML = `<div class="muted">Could not load events.</div>`;
    }
}

async function resetDemo() {
    if (!ADMIN_TOKEN) {
        throw new Error(
            "Reset disabled: ADMIN_TOKEN not embedded in the site. Set ADMIN_TOKEN for the site build/runtime."
        );
    }

    const data = await postJson(RESET_URL, {
        headers: { "X-Admin-Token": ADMIN_TOKEN },
    });

    if (!data || data.ok !== true) {
        throw new Error(
            `Could not reset demo: ${data ? String(data) : "no response body"}`
        );
    }
        return data;
}

document.addEventListener("DOMContentLoaded", () => {
    (async () => {
        try {
            await loadStatusAndEvents();
        } catch (err) {
            console.error("Initial loadStatusAndEvents failed:", err);
            setBadge("healthBadge", false, "Healthy", "Unreachable");
        }
    })();

    const clearBtn = document.getElementById("clearEvents");
    if (clearBtn) {
        clearBtn.addEventListener("click", async () => {
            if (!ADMIN_TOKEN) {
                window.alert("Public Demo: Admin actions disabled in demo mode.");
                return;
            }

            const ok = window.confirm(
                "Reset demo?\n\nThis will delete stored leads/events in the local SQLite DB for THIS instance."
            );
            if (!ok) return;

            clearBtn.disabled = true;
            try {
                await resetDemo();
                await loadStatusAndEvents();
            } catch (e) {
                window.alert(
                    `Reset failed: ${e?.message || String(e)}\n\nCheck RESET_URL + X-Admin-Token.`
                );
            } finally {
                clearBtn.disabled = false;
            }
        });
    }
});
