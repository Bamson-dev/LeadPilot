import { randomUUID } from "node:crypto";

const usersByEmail = new Map();
const usersById = new Map();
const licenses = new Map();
const outreachAccounts = new Map();
const mailboxes = [];
const ledger = [];
const systemTemplates = [
  { niche: "web_design", name: "No website found" },
  { niche: "social_media", name: "Low Instagram activity" },
  { niche: "seo", name: "Low Google rating" },
  { niche: "copywriting", name: "Weak website copy" },
];

function pick(row, columns) {
  if (!columns || columns === "*") return { ...row };
  const out = {};
  for (const col of columns.split(",").map((c) => c.trim())) {
    if (col in row) out[col] = row[col];
  }
  return out;
}

function makeQuery(table) {
  const state = {
    table,
    filters: [],
    op: "select",
    payload: null,
    conflict: null,
    head: false,
    countExact: false,
    limitN: null,
    order: null,
    isNullCol: null,
  };

  const api = {
    select(columns = "*", opts = {}) {
      state.columns = columns;
      state.head = Boolean(opts.head);
      state.countExact = opts.count === "exact";
      return api;
    },
    insert(row) {
      state.op = "insert";
      state.payload = row;
      return api;
    },
    upsert(row, opts = {}) {
      state.op = "upsert";
      state.payload = row;
      state.conflict = opts.onConflict;
      return api;
    },
    update(row) {
      state.op = "update";
      state.payload = row;
      return api;
    },
    delete() {
      state.op = "delete";
      return api;
    },
    eq(col, val) {
      state.filters.push({ col, op: "eq", val });
      return api;
    },
    neq(col, val) {
      state.filters.push({ col, op: "neq", val });
      return api;
    },
    is(col, val) {
      state.isNullCol = { col, val };
      return api;
    },
    order(col, opts = {}) {
      state.order = { col, ascending: opts.ascending !== false };
      return api;
    },
    limit(n) {
      state.limitN = n;
      return api;
    },
    maybeSingle() {
      return {
        then(resolve, reject) {
          return api.execute().then((result) => {
            const payload = Array.isArray(result.data)
              ? (result.data[0] ?? null)
              : (result.data ?? null);
            return resolve({ data: payload, error: null });
          }, reject);
        },
      };
    },
    async single() {
      const result = await api.execute();
      const payload = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!payload) {
        return { data: null, error: { message: "not found", code: "PGRST116" } };
      }
      return { data: payload, error: null };
    },
    then(resolve, reject) {
      return api.execute().then(resolve, reject);
    },
    async execute() {
      const match = (row) =>
        state.filters.every((f) => {
          if (f.op === "eq") return row[f.col] === f.val;
          if (f.op === "neq") return row[f.col] !== f.val;
          return true;
        });

      const finish = (payload) => {
        if (state.head && state.countExact) {
          const count = Array.isArray(payload) ? payload.length : payload ? 1 : 0;
          return { data: null, count, error: null };
        }
        return payload;
      };

      if (state.table === "users") {
        if (state.op === "select") {
          const rows = [...usersById.values()].filter(match);
          const result = finish(rows);
          if (result.count !== undefined) return result;
          const row = rows[0];
          return { data: row ? pick(row, state.columns) : null, error: null };
        }
        if (state.op === "insert") {
          const email = state.payload.email.toLowerCase().trim();
          const row = { id: randomUUID(), email, plan: "free", created_at: new Date().toISOString() };
          usersByEmail.set(email, row);
          usersById.set(row.id, row);
          return { data: pick(row, state.columns ?? "*"), error: null };
        }
      }

      if (state.table === "license_keys") {
        if (state.op === "select") {
          const rows = [...licenses.values()].filter(match);
          return { data: rows[0] ? pick(rows[0], state.columns) : null, error: null };
        }
      }

      if (state.table === "outreach_accounts") {
        if (state.op === "select") {
          const rows = [...outreachAccounts.values()].filter(match);
          const finished = finish(rows);
          if (finished.count !== undefined) return finished;
          const row = rows[0];
          if (state.columns && state.columns !== "*") {
            return { data: row ? pick(row, state.columns) : null, error: null };
          }
          return { data: row ?? null, error: null };
        }
        if (state.op === "insert" || state.op === "upsert") {
          const existing = outreachAccounts.get(state.payload.user_id);
          const row = {
            user_id: state.payload.user_id,
            subscription_status: "none",
            subscription_tier: null,
            max_mailboxes: 1,
            monthly_allowance: 0,
            monthly_allowance_remaining: 0,
            purchased_credits_balance: 0,
            free_sends_granted: 0,
            free_sends_used: 0,
            free_sends_expire_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...existing,
            ...state.payload,
          };
          outreachAccounts.set(row.user_id, row);
          return { data: row, error: null };
        }
        if (state.op === "update") {
          const row = [...outreachAccounts.values()].find(match);
          if (!row) return { data: null, error: { message: "not found" } };
          Object.assign(row, state.payload);
          return { data: row, error: null };
        }
        if (state.op === "delete") {
          for (const row of [...outreachAccounts.values()].filter(match)) {
            outreachAccounts.delete(row.user_id);
          }
          return { data: null, error: null };
        }
      }

      if (state.table === "connected_mailboxes") {
        if (state.op === "select") {
          let rows = mailboxes.filter(match);
          if (state.order) {
            rows = rows.sort((a, b) =>
              state.order.ascending
                ? String(a[state.order.col]).localeCompare(String(b[state.order.col]))
                : String(b[state.order.col]).localeCompare(String(a[state.order.col]))
            );
          }
          const finished = finish(rows);
          if (finished.count !== undefined) return finished;
          if (state.columns && !String(state.columns).includes("encrypted")) {
            rows = rows.map((r) => pick(r, state.columns));
          }
          return { data: rows, error: null };
        }
        if (state.op === "insert") {
          const row = {
            id: randomUUID(),
            created_at: new Date().toISOString(),
            smtp_host: "smtp.gmail.com",
            smtp_port: 587,
            status: "active",
            daily_send_count: 0,
            ...state.payload,
          };
          mailboxes.push(row);
          return { data: row, error: null };
        }
        if (state.op === "upsert") {
          const email = state.payload.email_address.toLowerCase().trim();
          let row = mailboxes.find(
            (m) => m.user_id === state.payload.user_id && m.email_address === email
          );
          if (row) Object.assign(row, state.payload, { email_address: email });
          else {
            row = {
              id: randomUUID(),
              created_at: new Date().toISOString(),
              ...state.payload,
              email_address: email,
            };
            mailboxes.push(row);
          }
          const selected = state.columns && state.columns !== "*"
            ? pick(row, state.columns)
            : row;
          return { data: selected, error: null };
        }
        if (state.op === "update") {
          const row = mailboxes.find(match);
          if (!row) return { data: null, error: { message: "not found" } };
          Object.assign(row, state.payload);
          return { data: row, error: null };
        }
        if (state.op === "delete") {
          for (let i = mailboxes.length - 1; i >= 0; i--) {
            if (match(mailboxes[i])) mailboxes.splice(i, 1);
          }
          return { data: null, error: null };
        }
      }

      if (state.table === "outreach_credit_transactions") {
        if (state.op === "insert") {
          const row = { id: randomUUID(), created_at: new Date().toISOString(), ...state.payload };
          ledger.push(row);
          return { data: row, error: null };
        }
        if (state.op === "select") {
          return { data: ledger.filter(match), error: null };
        }
        if (state.op === "delete") {
          for (let i = ledger.length - 1; i >= 0; i--) {
            if (match(ledger[i])) ledger.splice(i, 1);
          }
          return { data: null, error: null };
        }
      }

      if (state.table === "email_templates") {
        if (state.op === "select") {
          let rows = systemTemplates.map((t) => ({ user_id: null, ...t }));
          if (state.isNullCol?.val === null) {
            rows = rows.filter((r) => r[state.isNullCol.col] == null);
          }
          return { data: rows, error: null };
        }
      }

      return { data: null, error: { message: `Unhandled ${state.table} ${state.op}`, code: "42P01" } };
    },
  };

  return api;
}

export const mockSupabase = {
  from(table) {
    return makeQuery(table);
  },
};

export function seedLicense(email, key, id = randomUUID()) {
  const normalized = email.toLowerCase().trim();
  const record = {
    id,
    email: normalized,
    key: key.toUpperCase(),
    activated: true,
    is_suspended: false,
    max_devices: 4,
    monthly_search_limit: 100,
  };
  licenses.set(`${normalized}|${record.key}`, record);
  return record;
}

export function seedUser(email) {
  const normalized = email.toLowerCase().trim();
  const row = { id: randomUUID(), email: normalized, plan: "free", created_at: new Date().toISOString() };
  usersByEmail.set(normalized, row);
  usersById.set(row.id, row);
  return row;
}

export function mailboxCountForUser(userId) {
  return mailboxes.filter((m) => m.user_id === userId).length;
}

export function getOutreachAccount(userId) {
  return outreachAccounts.get(userId) ?? null;
}

export function getLedgerForUser(userId) {
  return ledger.filter((row) => row.user_id === userId);
}

export function getMailboxById(id) {
  return mailboxes.find((row) => row.id === id) ?? null;
}

export function insertMailbox(row) {
  const record = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    status: "active",
    daily_send_count: 0,
    ...row,
  };
  mailboxes.push(record);
  return record;
}

export function setOutreachAccount(userId, fields) {
  const existing = outreachAccounts.get(userId);
  const row = {
    user_id: userId,
    subscription_status: "none",
    subscription_tier: null,
    max_mailboxes: 1,
    monthly_allowance: 0,
    monthly_allowance_remaining: 0,
    purchased_credits_balance: 0,
    free_sends_granted: 0,
    free_sends_used: 0,
    free_sends_expire_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...existing,
    ...fields,
  };
  outreachAccounts.set(userId, row);
  return row;
}

export function resetMailboxMocks() {
  usersByEmail.clear();
  usersById.clear();
  licenses.clear();
  outreachAccounts.clear();
  mailboxes.length = 0;
  ledger.length = 0;
}

export async function registerMailboxMocks({ mockSmtpVerify = false } = {}) {
  const Module = await import("node:module");
  const originalLoad = Module.default._load;

  Module.default._load = function (request, parent, isMain) {
    if (request.includes("database/client")) {
      return { supabase: mockSupabase };
    }

    if (request.includes("database/outreach-repository")) {
      return {
        ensureUserIdForEmail: async (email) => {
          const normalized = email.toLowerCase().trim();
          const existing = usersByEmail.get(normalized);
          if (existing?.id) return existing.id;
          const row = {
            id: randomUUID(),
            email: normalized,
            plan: "free",
            created_at: new Date().toISOString(),
          };
          usersByEmail.set(normalized, row);
          usersById.set(row.id, row);
          return row.id;
        },
        ensureOutreachAccount: async (userId) => {
          const existing = outreachAccounts.get(userId);
          if (existing) return existing;
          const row = {
            user_id: userId,
            subscription_status: "none",
            subscription_tier: null,
            max_mailboxes: 1,
            monthly_allowance: 0,
            monthly_allowance_remaining: 0,
            purchased_credits_balance: 0,
            free_sends_granted: 0,
            free_sends_used: 0,
            free_sends_expire_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          outreachAccounts.set(userId, row);
          return row;
        },
        getOutreachAccount: async (userId) => outreachAccounts.get(userId) ?? null,
        countActiveMailboxes: async (userId, excludeEmail) => {
          const exclude = excludeEmail?.toLowerCase().trim();
          return mailboxes.filter(
            (m) =>
              m.user_id === userId &&
              m.status === "active" &&
              (!exclude || m.email_address !== exclude)
          ).length;
        },
        countAllMailboxes: async (userId) =>
          mailboxes.filter((m) => m.user_id === userId).length,
        upsertConnectedMailbox: async (params) => {
          const email = params.emailAddress.toLowerCase().trim();
          let row = mailboxes.find((m) => m.user_id === params.userId && m.email_address === email);
          const now = new Date().toISOString();
          if (row) {
            Object.assign(row, {
              encrypted_app_password: params.encryptedAppPassword,
              account_type: params.accountType,
              status: "active",
              daily_cap: params.dailyCap,
              daily_send_count: 0,
              daily_count_reset_at: now,
              last_verified_at: now,
              last_error: null,
            });
          } else {
            row = {
              id: randomUUID(),
              user_id: params.userId,
              email_address: email,
              encrypted_app_password: params.encryptedAppPassword,
              smtp_host: "smtp.gmail.com",
              smtp_port: 587,
              account_type: params.accountType,
              status: "active",
              daily_cap: params.dailyCap,
              daily_send_count: 0,
              daily_count_reset_at: now,
              last_verified_at: now,
              last_error: null,
              created_at: now,
            };
            mailboxes.push(row);
          }
          return row;
        },
        listActiveMailboxes: async (userId) =>
          mailboxes.filter((m) => m.user_id === userId && m.status === "active"),
        disconnectMailbox: async (userId, mailboxId) => {
          const row = mailboxes.find((m) => m.id === mailboxId && m.user_id === userId);
          if (!row) return;
          row.status = "disconnected";
          row.encrypted_app_password = null;
          row.last_error = null;
        },
        grantFirstMailboxTrialCredits: async (userId) => {
          const expireAt = new Date();
          expireAt.setDate(expireAt.getDate() + 30);
          const account = outreachAccounts.get(userId) ?? {
            user_id: userId,
            free_sends_granted: 0,
            free_sends_used: 0,
          };
          account.free_sends_granted = 200;
          account.free_sends_expire_at = expireAt.toISOString();
          outreachAccounts.set(userId, account);
          ledger.push({
            id: randomUUID(),
            user_id: userId,
            type: "trial_grant",
            bucket: "free_trial",
            amount: 200,
            reference: "first_mailbox_connect",
            created_at: new Date().toISOString(),
          });
        },
      };
    }

    if (request.includes("database/license-repository")) {
      return {
        getLicenseByKeyAndEmail: async (key, email) => {
          const record = licenses.get(
            `${String(email).toLowerCase().trim()}|${String(key).trim().toUpperCase()}`
          );
          if (!record) return null;
          return {
            id: record.id,
            email: record.email,
            key: record.key,
            activated: record.activated,
            is_suspended: record.is_suspended,
          };
        },
      };
    }

    if (mockSmtpVerify && request.includes("services/mailbox-smtp")) {
      const actual = originalLoad(request, parent, isMain);
      return {
        ...actual,
        verifyGmailMailboxCredentials: async () => {},
        GMAIL_CONNECT_HELP: actual.GMAIL_CONNECT_HELP,
        dailyCapForAccountType: actual.dailyCapForAccountType,
      };
    }

    return originalLoad(request, parent, isMain);
  };
}
