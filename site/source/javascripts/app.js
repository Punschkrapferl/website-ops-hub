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
// SECURITY: Do NOT embed ADMIN_TOKEN in HTML/meta for public deployments.
// In this project, we only *use* the meta token in dev (:4567).

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

function clearStoredAdminToken() {
    try {
        window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
        // ignore
    }
}

function getMetaAdminToken() {
    try {
        const el = document.querySelector('meta[name="admin-token"]');
        const v = (el && el.getAttribute("content")) || "";
        return String(v).trim();
    } catch {
        return "";
    }
}

/**
 * If you're in dev (:4567), prefer the token injected into the HTML (meta tag).
 * That avoids prompts and avoids stale sessionStorage tokens after changing .env.
 * Fallback to sessionStorage, then prompt.
 */
function getAdminTokenOrPrompt() {
    if (!IS_DEV) return "";

    // 1) Prefer meta token in dev (freshest)
    const metaToken = getMetaAdminToken();
    if (metaToken) {
        const stored = getStoredAdminToken();
        if (stored !== metaToken) setStoredAdminToken(metaToken);
        return metaToken;
    }

    // 2) Fallback: sessionStorage token
    const existing = getStoredAdminToken();
    if (existing) return existing;

    // 3) Last resort: prompt
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

function makeHttpError(status, message) {
    const err = new Error(message);
    // attach status for callers
    err.status = status;
    return err;
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
        throw makeHttpError(res.status, msg);
    }

    // If server ever returns non-JSON, treat it as failure.
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
        throw makeHttpError(0, `Expected JSON but got: ${ct || "unknown content-type"}`);
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
        const serverMsg = extractApiErrorMessage(data);

        if (res.status === 401) {
            // In dev, 401 is almost always a stale/wrong token.
            const msg =
                serverMsg ||
                (IS_DEV ? "Invalid admin token (check ADMIN_TOKEN)" : "Public demo: admin token required");
            throw makeHttpError(401, msg);
        }

        throw makeHttpError(res.status, serverMsg || `HTTP ${res.status}`);
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

        // 3-column layout:
        // [badges] [time] [message]
        row.innerHTML = `
          <div class="event-left">
            <div class="d-flex align-items-center gap-2">
              <span class="badge badge-soft">${type}</span>
              <span class="badge badge-soft">${status}</span>
            </div>
          </div>

          <div class="event-time muted small">${t}</div>

          <div class="event-msg">
            ${detail ? `<div class="muted small">${detail}</div>` : ""}
          </div>
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
    const headers = token ? { "X-Admin-Token": token } : {};
    const data = await postJson(RESET_URL, { headers });

    if (!data || data.ok !== true) {
        throw new Error(`Could not reset demo: ${data ? String(data) : "no response body"}`);
    }

    return data;
}

// Retry once in dev if we get a 401 (usually stale sessionStorage token)
async function resetDemoWithDevRetry() {
    const token1 = getAdminTokenOrPrompt();
    if (!token1) throw new Error("Invalid admin token (check ADMIN_TOKEN)");

    try {
        return await resetDemo(token1);
    } catch (e) {
        if (IS_DEV && e && e.status === 401) {
            clearStoredAdminToken();

            // After clearing, we’ll re-prefer the meta token (fresh) and only prompt if needed.
            const token2 = getAdminTokenOrPrompt();
            if (token2 && token2 !== token1) {
                return await resetDemo(token2);
            }
        }
        throw e;
    }
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
        // Public demo: keep it clickable, but don't perform admin action.
        if (!IS_DEV) {
            clearBtn.disabled = false; // IMPORTANT: do not disable
            clearBtn.title = "Admin actions disabled in public demo.";
        }

        clearBtn.addEventListener("click", async () => {
            if (!IS_DEV) {
                window.alert("Public demo: admin actions are disabled.");
                return;
            }

            const ok = window.confirm(
                "Reset dev instance?\n\nThis will delete stored leads/events in the local SQLite DB for THIS instance."
            );
            if (!ok) return;

            clearBtn.disabled = true;
            try {
                await resetDemoWithDevRetry();
                await loadStatusAndEvents();
            } catch (e) {
                window.alert(`Reset failed: ${e?.message || String(e)}`);
            } finally {
                clearBtn.disabled = false;
            }
        });
    }
});
