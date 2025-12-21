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
// SECURITY: Do NOT embed ADMIN_TOKEN in HTML/meta. If needed in dev, prompt for it.

const IS_DEV = window.location.port === "4567";

const API_BASE = (() => {
    return IS_DEV ? "http://localhost:8080" : "";
})();

const EVENTS_LIST_URL = `${API_BASE}/api/events?limit=8`;
const RESET_URL = `${API_BASE}/api/admin/reset`;
const HEALTH_URL = `${API_BASE}/health`;

const ADMIN_TOKEN_STORAGE_KEY = "opsHubAdminToken";

function getStoredAdminToken() {
    try {
        return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
    } catch {
        return "";
    }
}

function setStoredAdminToken(token) {
    try {
        window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } catch {
        // ignore
    }
}

/**
 * If you're in dev (:4567), you can paste the token once per session.
 * In demo (nginx), admin actions stay disabled.
 */
function getAdminTokenOrPrompt() {
    if (!IS_DEV) return "";

    const existing = getStoredAdminToken();
    if (existing) return existing;

    const token = window.prompt(
        "Admin reset is DEV-only.\n\nPaste ADMIN_TOKEN to enable reset for this session:",
        ""
    );

    const cleaned = (token || "").trim();
    if (cleaned) setStoredAdminToken(cleaned);
    return cleaned;
}

function extractApiErrorMessage(data) {
    if (!data) return "";
    if (typeof data === "string") return data;

    // Common API error shapes (Express/FastAPI/etc.)
    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
    if (typeof data.detail === "string") return data.detail;

    // FastAPI often uses detail as list/dict
    if (data.detail != null) {
        try {
            return JSON.stringify(data.detail);
        } catch {
            return String(data.detail);
        }
    }

    return "";
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });

    // Try to surface server-provided message even on non-2xx
    let data = null;
    try {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) data = await res.json();
    } catch {
        // ignore
    }

    if (!res.ok) {
        const msg = extractApiErrorMessage(data) || `HTTP ${res.status}`;
        throw new Error(msg);
    }

    // If server ever returns non-JSON, treat it as failure.
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
        throw new Error(`Expected JSON but got: ${ct || "unknown content-type"}`);
    }

    // If we already parsed it above, reuse it
    if (data != null) return data;
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

    let data = null;
    try {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) data = await res.json();
    } catch {
        // ignore non-JSON bodies
    }

    if (!res.ok) {
        // Prefer server message; otherwise show a friendly 401 for demo/admin endpoints
        const serverMsg = extractApiErrorMessage(data);

        if (res.status === 401) {
            // This is the message you expected to see instead of "HTTP 401"
            throw new Error(serverMsg || "Public demo: admin token required");
        }

        throw new Error(serverMsg || `HTTP ${res.status}`);
    }

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

async function resetDemo(token) {
    if (!token) {
        // Keep wording consistent with what you want to show
        throw new Error("Public demo: admin token required");
    }

    const data = await postJson(RESET_URL, {
        headers: { "X-Admin-Token": token },
    });

    if (!data || data.ok !== true) {
        throw new Error(`Could not reset demo: ${data ? String(data) : "no response body"}`);
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

    const refreshBtn = document.getElementById("refreshEvents");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            refreshBtn.disabled = true;
            try {
                await loadStatusAndEvents();
            } finally {
                refreshBtn.disabled = false;
            }
        });
    }

    const clearBtn = document.getElementById("clearEvents");
    if (clearBtn) {
        // Public demo: hide or disable admin action completely.
        if (!IS_DEV) {
            clearBtn.disabled = true;
            clearBtn.title = "Admin actions disabled in public demo.";
        }

        clearBtn.addEventListener("click", async () => {
            if (!IS_DEV) {
                // If it ever gets clicked anyway, show the exact message you expect
                window.alert("Public demo: admin token required");
                return;
            }

            const token = getAdminTokenOrPrompt();
            if (!token) {
                window.alert("Public demo: admin token required");
                return;
            }

            const ok = window.confirm(
                "Reset dev instance?\n\nThis will delete stored leads/events in the local SQLite DB for THIS instance."
            );
            if (!ok) return;

            clearBtn.disabled = true;
            try {
                await resetDemo(token);
                await loadStatusAndEvents();
            } catch (e) {
                window.alert(
                    `Reset failed: ${e?.message || String(e)}\n\nCheck RESET_URL and API token validation.`
                );
            } finally {
                clearBtn.disabled = false;
            }
        });
    }
});
