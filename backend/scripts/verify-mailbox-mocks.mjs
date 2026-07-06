import { randomUUID } from "node:crypto";

const usersByEmail = new Map();
const usersById = new Map();
const licenses = new Map();
const outreachAccounts = new Map();
const mailboxes = [];
const ledger = [];
const sentEmails = [];
const suppressions = [];
const outreachPaystackPlans = new Map();
const lastSmtpPayloads = [];
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
    range: null,
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
    lt(col, val) {
      state.filters.push({ col, op: "lt", val });
      return api;
    },
    in(col, vals) {
      state.filters.push({ col, op: "in", val: vals });
      return api;
    },
    is(col, val) {
      state.isNullCol = { col, val };
      return api;
    },
    not(col, op, val) {
      state.filters.push({ col, op: "not", subOp: op, val });
      return api;
    },
    range(from, to) {
      state.range = { from, to };
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
          if (f.op === "lt") return row[f.col] != null && row[f.col] < f.val;
          if (f.op === "in") return Array.isArray(f.val) && f.val.includes(row[f.col]);
          if (f.op === "not" && f.subOp === "is" && f.val === null) {
            return row[f.col] != null;
          }
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
            subscription_renews_at: null,
            grace_until: null,
            paystack_subscription_code: null,
            max_mailboxes: 1,
            monthly_allowance: 0,
            monthly_allowance_remaining: 0,
            monthly_allowance_reset_at: null,
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

      if (state.table === "sent_emails") {
        if (state.op === "select") {
          let rows = sentEmails.filter(match);
          if (state.order) {
            rows = rows.sort((a, b) =>
              state.order.ascending
                ? String(a[state.order.col]).localeCompare(String(b[state.order.col]))
                : String(b[state.order.col]).localeCompare(String(a[state.order.col]))
            );
          }
          const finished = finish(rows);
          if (finished.count !== undefined) return finished;
          if (state.range) {
            rows = rows.slice(state.range.from, state.range.to + 1);
          } else if (state.limitN != null) {
            rows = rows.slice(0, state.limitN);
          }
          if (state.columns && state.columns !== "*") {
            rows = rows.map((r) => pick(r, state.columns));
          }
          return { data: rows, error: null };
        }
        if (state.op === "insert") {
          const row = {
            id: randomUUID(),
            mailbox_id: null,
            lead_id: null,
            search_id: null,
            status: "queued",
            credit_bucket: null,
            provider_message_id: null,
            error_message: null,
            opened_at: null,
            open_count: 0,
            sent_at: null,
            created_at: new Date().toISOString(),
            ...state.payload,
          };
          sentEmails.push(row);
          return { data: row, error: null };
        }
        if (state.op === "update") {
          const row = sentEmails.find(match);
          if (!row) return { data: null, error: { message: "not found" } };
          Object.assign(row, state.payload);
          return { data: row, error: null };
        }
        if (state.op === "delete") {
          for (let i = sentEmails.length - 1; i >= 0; i--) {
            if (match(sentEmails[i])) sentEmails.splice(i, 1);
          }
          return { data: null, error: null };
        }
      }

      if (state.table === "outreach_paystack_plans") {
        if (state.op === "select") {
          const rows = [...outreachPaystackPlans.values()].filter(match);
          const finished = finish(rows);
          if (finished.count !== undefined) return finished;
          if (!state.columns || state.columns === "*") {
            return { data: rows, error: null };
          }
          const row = rows[0];
          return { data: row ? pick(row, state.columns) : null, error: null };
        }
        if (state.op === "upsert" || state.op === "insert") {
          const row = {
            updated_at: new Date().toISOString(),
            ...state.payload,
          };
          outreachPaystackPlans.set(row.tier, row);
          return { data: row, error: null };
        }
      }

      if (state.table === "email_suppression") {
        if (state.op === "select") {
          const rows = suppressions.filter(match);
          const finished = finish(rows);
          if (finished.count !== undefined) return finished;
          const row = rows[0];
          return { data: row ? pick(row, state.columns) : null, error: null };
        }
        if (state.op === "insert") {
          const row = {
            id: randomUUID(),
            unsubscribed_at: new Date().toISOString(),
            ...state.payload,
            recipient_email: state.payload.recipient_email.toLowerCase().trim(),
          };
          suppressions.push(row);
          return { data: row, error: null };
        }
        if (state.op === "upsert") {
          const normalized = state.payload.recipient_email.toLowerCase().trim();
          let row = suppressions.find(
            (s) => s.user_id === state.payload.user_id && s.recipient_email === normalized
          );
          if (row) {
            Object.assign(row, state.payload, { recipient_email: normalized });
          } else {
            row = {
              id: randomUUID(),
              unsubscribed_at: new Date().toISOString(),
              ...state.payload,
              recipient_email: normalized,
            };
            suppressions.push(row);
          }
          return { data: row, error: null };
        }
        if (state.op === "delete") {
          for (let i = suppressions.length - 1; i >= 0; i--) {
            if (match(suppressions[i])) suppressions.splice(i, 1);
          }
          return { data: null, error: null };
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

export function getSentEmailsForUser(userId) {
  return sentEmails.filter((row) => row.user_id === userId);
}

export function getSentEmailById(id) {
  return sentEmails.find((row) => row.id === id) ?? null;
}

export function insertSentEmail(row) {
  const record = {
    id: randomUUID(),
    mailbox_id: null,
    status: "queued",
    credit_bucket: null,
    provider_message_id: null,
    error_message: null,
    opened_at: null,
    open_count: 0,
    sent_at: null,
    created_at: new Date().toISOString(),
    ...row,
  };
  sentEmails.push(record);
  return record;
}

export function insertSuppression(userId, recipientEmail) {
  const row = {
    id: randomUUID(),
    user_id: userId,
    recipient_email: recipientEmail.toLowerCase().trim(),
    unsubscribed_at: new Date().toISOString(),
  };
  suppressions.push(row);
  return row;
}

export function isRecipientSuppressedInMock(userId, recipientEmail) {
  const normalized = recipientEmail.toLowerCase().trim();
  return suppressions.some(
    (s) => s.user_id === userId && s.recipient_email === normalized
  );
}

export function getMailboxById(id) {
  return mailboxes.find((row) => row.id === id) ?? null;
}

export function seedPaystackPlans(plans) {
  for (const plan of plans) {
    outreachPaystackPlans.set(plan.tier, {
      updated_at: new Date().toISOString(),
      ...plan,
    });
  }
}

export function getStoredPaystackPlans() {
  return [...outreachPaystackPlans.values()];
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
    subscription_renews_at: null,
    grace_until: null,
    paystack_subscription_code: null,
    max_mailboxes: 1,
    monthly_allowance: 0,
    monthly_allowance_remaining: 0,
    monthly_allowance_reset_at: null,
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
  outreachPaystackPlans.clear();
  mailboxes.length = 0;
  ledger.length = 0;
  sentEmails.length = 0;
  suppressions.length = 0;
  lastSmtpPayloads.length = 0;
}

export function getLastSmtpPayloads() {
  return [...lastSmtpPayloads];
}

export async function registerMailboxMocks({
  mockSmtpVerify = false,
  mockPaystack = false,
  skipOutreachRepoMock = false,
} = {}) {
  const Module = await import("node:module");
  const originalLoad = Module.default._load;

  Module.default._load = function (request, parent, isMain) {
    if (mockPaystack && request.includes("paystack-client")) {
      return {
        listPaystackPlans: async () => [],
        createPaystackPlan: async ({ name, amountKobo }) => ({
          id: 1,
          name,
          plan_code: `PLN_TEST_${amountKobo}`,
          amount: amountKobo,
          interval: "monthly",
        }),
        initializePaystackTransaction: async () => ({
          authorization_url: "https://checkout.paystack.com/test",
          access_code: "test-access",
          reference: "LT-OUT-TEST",
        }),
        verifyTransaction: async () => ({
          status: "success",
          amount: 0,
          customer: { email: "" },
          metadata: {},
          reference: "",
        }),
        getPaystack: () => ({}),
        paystackAsync: async () => ({}),
      };
    }

    if (request.includes("database/client")) {
      return { supabase: mockSupabase };
    }

    if (!skipOutreachRepoMock && request.includes("database/outreach-repository")) {
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
            subscription_renews_at: null,
            grace_until: null,
            paystack_subscription_code: null,
            max_mailboxes: 1,
            monthly_allowance: 0,
            monthly_allowance_remaining: 0,
            monthly_allowance_reset_at: null,
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
        computeFreeTrialRemaining: (account) => {
          if (account.free_sends_expire_at && new Date(account.free_sends_expire_at) <= new Date()) {
            return 0;
          }
          return Math.max(0, account.free_sends_granted - account.free_sends_used);
        },
        computeAvailableSends: (account) => {
          let freeRemaining = 0;
          if (!account.free_sends_expire_at || new Date(account.free_sends_expire_at) > new Date()) {
            freeRemaining = Math.max(0, account.free_sends_granted - account.free_sends_used);
          }
          return (
            freeRemaining +
            account.monthly_allowance_remaining +
            account.purchased_credits_balance
          );
        },
        isRecipientSuppressed: async (userId, recipientEmail) => {
          const normalized = recipientEmail.toLowerCase().trim();
          return suppressions.some(
            (s) => s.user_id === userId && s.recipient_email === normalized
          );
        },
        getEmailTemplateById: async () => null,
        createQueuedSentEmail: async (params) => {
          const row = {
            id: randomUUID(),
            user_id: params.userId,
            mailbox_id: null,
            recipient_email: params.recipientEmail.toLowerCase().trim(),
            business_name: params.businessName ?? null,
            subject: params.subject,
            body: params.body,
            status: "queued",
            tracking_token: params.trackingToken,
            credit_bucket: null,
            provider_message_id: null,
            error_message: null,
            opened_at: null,
            open_count: 0,
            sent_at: null,
            created_at: new Date().toISOString(),
          };
          sentEmails.push(row);
          return row;
        },
        getSentEmailById: async (id) => sentEmails.find((r) => r.id === id) ?? null,
        getMailboxWithSecret: async (mailboxId, userId) =>
          mailboxes.find(
            (m) => m.id === mailboxId && m.user_id === userId && m.status === "active"
          ) ?? null,
        listActiveMailboxesWithSecrets: async (userId) =>
          mailboxes.filter((m) => m.user_id === userId && m.status === "active"),
        resetMailboxDailyCountIfNeeded: async (mailbox) => {
          if (!mailbox.daily_count_reset_at) return mailbox;
          if (new Date(mailbox.daily_count_reset_at) > new Date()) return mailbox;
          const nextReset = new Date();
          nextReset.setHours(nextReset.getHours() + 24);
          mailbox.daily_send_count = 0;
          mailbox.daily_count_reset_at = nextReset.toISOString();
          return mailbox;
        },
        incrementMailboxSendCount: async (mailboxId) => {
          const row = mailboxes.find((m) => m.id === mailboxId);
          if (row) row.daily_send_count = (row.daily_send_count ?? 0) + 1;
        },
        assignSentEmailMailbox: async (sentEmailId, mailboxId) => {
          const row = sentEmails.find((r) => r.id === sentEmailId);
          if (row) {
            row.mailbox_id = mailboxId;
            row.status = "sending";
          }
        },
        markSentEmailSent: async (params) => {
          const row = sentEmails.find((r) => r.id === params.sentEmailId);
          if (row) {
            row.status = "sent";
            row.provider_message_id = params.providerMessageId;
            row.credit_bucket = params.creditBucket;
            row.sent_at = new Date().toISOString();
          }
        },
        markSentEmailFailed: async (sentEmailId, errorMessage) => {
          const row = sentEmails.find((r) => r.id === sentEmailId);
          if (row) {
            row.status = "failed";
            row.error_message = errorMessage;
          }
        },
        deductOneSendCredit: async (userId) => {
          const account = outreachAccounts.get(userId);
          if (!account) throw new Error("No outreach account");
          let freeRemaining = 0;
          if (!account.free_sends_expire_at || new Date(account.free_sends_expire_at) > new Date()) {
            freeRemaining = Math.max(0, account.free_sends_granted - account.free_sends_used);
          }
          if (freeRemaining > 0) {
            account.free_sends_used += 1;
            return "free_trial";
          }
          if (account.monthly_allowance_remaining > 0) {
            account.monthly_allowance_remaining -= 1;
            return "monthly_allowance";
          }
          if (account.purchased_credits_balance > 0) {
            account.purchased_credits_balance -= 1;
            return "purchased_credits";
          }
          throw new Error("No send credits available");
        },
        logCreditSpend: async (params) => {
          ledger.push({
            id: randomUUID(),
            user_id: params.userId,
            type: "spend",
            bucket: params.bucket,
            amount: -1,
            reference: params.sentEmailId,
            created_at: new Date().toISOString(),
          });
        },
        refundSendCredit: async (params) => {
          const account = outreachAccounts.get(params.userId);
          if (!account) throw new Error("Outreach account not found");
          if (params.bucket === "free_trial") {
            account.free_sends_used = Math.max(0, account.free_sends_used - 1);
          } else if (params.bucket === "monthly_allowance") {
            account.monthly_allowance_remaining += 1;
          } else {
            account.purchased_credits_balance += 1;
          }
          ledger.push({
            id: randomUUID(),
            user_id: params.userId,
            type: "refund",
            bucket: params.bucket,
            amount: 1,
            reference: params.sentEmailId,
            created_at: new Date().toISOString(),
          });
        },
        recordOutreachEmailOpen: async (trackingToken) => {
          const row = sentEmails.find((r) => r.tracking_token === trackingToken);
          if (!row) return;
          row.open_count = (row.open_count ?? 0) + 1;
          if (!row.opened_at) row.opened_at = new Date().toISOString();
        },
        getSentEmailByTrackingToken: async (trackingToken) => {
          const row = sentEmails.find((r) => r.tracking_token === trackingToken);
          if (!row) return null;
          return {
            id: row.id,
            user_id: row.user_id,
            recipient_email: row.recipient_email,
          };
        },
        suppressRecipientForUser: async (userId, recipientEmail) => {
          const normalized = recipientEmail.toLowerCase().trim();
          let row = suppressions.find(
            (s) => s.user_id === userId && s.recipient_email === normalized
          );
          if (row) {
            row.unsubscribed_at = new Date().toISOString();
          } else {
            suppressions.push({
              id: randomUUID(),
              user_id: userId,
              recipient_email: normalized,
              unsubscribed_at: new Date().toISOString(),
            });
          }
        },
        getOutreachPaystackPlanCode: async (tier) => outreachPaystackPlans.get(tier) ?? null,
        upsertOutreachPaystackPlan: async (row) => {
          const record = {
            tier: row.tier,
            plan_code: row.planCode,
            amount_kobo: row.amountKobo,
            monthly_allowance: row.monthlyAllowance,
            max_mailboxes: row.maxMailboxes,
            updated_at: new Date().toISOString(),
          };
          outreachPaystackPlans.set(row.tier, record);
        },
        listOutreachPaystackPlans: async () => [...outreachPaystackPlans.values()],
        isOutreachLedgerReferenceProcessed: async (reference) =>
          ledger.some((row) => row.reference === reference.trim()),
        creditPurchasedPack: async (params) => {
          if (ledger.some((row) => row.reference === params.reference.trim())) {
            return { credited: false, duplicate: true };
          }
          let account = outreachAccounts.get(params.userId);
          if (!account) {
            account = {
              user_id: params.userId,
              subscription_status: "none",
              subscription_tier: null,
              subscription_renews_at: null,
              grace_until: null,
              paystack_subscription_code: null,
              max_mailboxes: 1,
              monthly_allowance: 0,
              monthly_allowance_remaining: 0,
              monthly_allowance_reset_at: null,
              purchased_credits_balance: 0,
              free_sends_granted: 0,
              free_sends_used: 0,
              free_sends_expire_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            outreachAccounts.set(params.userId, account);
          }
          account.purchased_credits_balance += params.credits;
          ledger.push({
            id: randomUUID(),
            user_id: params.userId,
            type: "purchase",
            bucket: "purchased_credits",
            amount: params.credits,
            reference: params.reference,
            created_at: new Date().toISOString(),
          });
          return { credited: true, duplicate: false };
        },
        activateOutreachSubscription: async (params) => {
          if (ledger.some((row) => row.reference === params.reference.trim())) {
            return { applied: false, duplicate: true };
          }
          let account = outreachAccounts.get(params.userId);
          if (!account) {
            account = { user_id: params.userId };
            outreachAccounts.set(params.userId, account);
          }
          const resetAt = new Date();
          resetAt.setMonth(resetAt.getMonth() + 1);
          Object.assign(account, {
            subscription_status: "active",
            subscription_tier: params.tier,
            max_mailboxes: params.maxMailboxes,
            monthly_allowance: params.monthlyAllowance,
            monthly_allowance_remaining: params.monthlyAllowance,
            monthly_allowance_reset_at: resetAt.toISOString(),
            grace_until: null,
            subscription_renews_at: params.renewsAt ?? account.subscription_renews_at ?? null,
            paystack_subscription_code:
              params.subscriptionCode ?? account.paystack_subscription_code ?? null,
            updated_at: new Date().toISOString(),
          });
          ledger.push({
            id: randomUUID(),
            user_id: params.userId,
            type: "monthly_refill",
            bucket: "monthly_allowance",
            amount: params.monthlyAllowance,
            reference: params.reference,
            created_at: new Date().toISOString(),
          });
          return { applied: true, duplicate: false };
        },
        storePaystackSubscription: async (params) => {
          let account = outreachAccounts.get(params.userId);
          if (!account) {
            account = { user_id: params.userId };
            outreachAccounts.set(params.userId, account);
          }
          account.paystack_subscription_code = params.subscriptionCode;
          if (params.renewsAt) account.subscription_renews_at = params.renewsAt;
        },
        findOutreachUserByPaystackSubscription: async (subscriptionCode) => {
          for (const account of outreachAccounts.values()) {
            if (account.paystack_subscription_code === subscriptionCode) return account.user_id;
          }
          return null;
        },
        enterOutreachGracePeriod: async (userId) => {
          const account = outreachAccounts.get(userId);
          if (!account) return;
          const graceUntil = new Date();
          graceUntil.setDate(graceUntil.getDate() + 3);
          account.subscription_status = "grace";
          account.grace_until = graceUntil.toISOString();
        },
        expireOutreachGraceAccounts: async () => {
          const now = Date.now();
          let count = 0;
          for (const account of outreachAccounts.values()) {
            if (
              account.subscription_status === "grace" &&
              account.grace_until &&
              new Date(account.grace_until).getTime() < now
            ) {
              account.subscription_status = "none";
              account.monthly_allowance_remaining = 0;
              account.grace_until = null;
              count += 1;
            }
          }
          return count;
        },
        getOutreachBalance: async (userId) => {
          const account = outreachAccounts.get(userId) ?? {
            subscription_status: "none",
            subscription_tier: null,
            max_mailboxes: 1,
            monthly_allowance_remaining: 0,
            purchased_credits_balance: 0,
            free_sends_granted: 0,
            free_sends_used: 0,
            free_sends_expire_at: null,
            monthly_allowance_reset_at: null,
            subscription_renews_at: null,
            grace_until: null,
          };
          let freeTrialRemaining = 0;
          if (!account.free_sends_expire_at || new Date(account.free_sends_expire_at) > new Date()) {
            freeTrialRemaining = Math.max(0, account.free_sends_granted - account.free_sends_used);
          }
          const mailboxCount = mailboxes.filter(
            (m) => m.user_id === userId && m.status === "active"
          ).length;
          return {
            send_balance:
              freeTrialRemaining +
              account.monthly_allowance_remaining +
              account.purchased_credits_balance,
            free_trial_remaining: freeTrialRemaining,
            monthly_allowance_remaining: account.monthly_allowance_remaining,
            purchased_credits: account.purchased_credits_balance,
            subscription_tier: account.subscription_tier ?? null,
            subscription_status: account.subscription_status ?? "none",
            max_mailboxes: account.max_mailboxes ?? 1,
            mailbox_count: mailboxCount,
            monthly_allowance_reset_at: account.monthly_allowance_reset_at ?? null,
            subscription_renews_at: account.subscription_renews_at ?? null,
            grace_until: account.grace_until ?? null,
            free_sends_expire_at: account.free_sends_expire_at ?? null,
          };
        },
        getSentEmailsSummary: async (userId) => {
          const sentRows = sentEmails.filter((r) => r.user_id === userId && r.status === "sent");
          const total_sent = sentRows.length;
          const total_opened = sentRows.filter((r) => r.opened_at != null).length;
          const open_rate =
            total_sent > 0 ? Math.round((total_opened / total_sent) * 1000) / 10 : 0;
          return { total_sent, total_opened, open_rate };
        },
        listSentEmails: async (userId, options = {}) => {
          const limit = Math.min(100, Math.max(1, options.limit ?? 25));
          const offset = Math.max(0, options.offset ?? 0);
          const statusFilter =
            options.status && options.status !== "all" ? options.status : null;
          const orderCol = options.sort === "sent_at" ? "sent_at" : "created_at";

          let rows = sentEmails.filter((r) => r.user_id === userId);
          if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
          rows = [...rows].sort((a, b) =>
            String(b[orderCol] ?? "").localeCompare(String(a[orderCol] ?? ""))
          );

          const mailboxMap = new Map(mailboxes.map((m) => [m.id, m.email_address]));
          const sentRows = sentEmails.filter((r) => r.user_id === userId && r.status === "sent");
          const total_sent = sentRows.length;
          const total_opened = sentRows.filter((r) => r.opened_at != null).length;
          const open_rate =
            total_sent > 0 ? Math.round((total_opened / total_sent) * 1000) / 10 : 0;

          return {
            sends: rows.slice(offset, offset + limit).map((row) => ({
              id: row.id,
              recipient_email: row.recipient_email,
              business_name: row.business_name ?? null,
              subject: row.subject,
              status: row.status,
              error_message: row.error_message ?? null,
              opened_at: row.opened_at ?? null,
              open_count: row.open_count ?? 0,
              sent_at: row.sent_at ?? null,
              created_at: row.created_at,
              mailbox_id: row.mailbox_id ?? null,
              mailbox_email: row.mailbox_id ? mailboxMap.get(row.mailbox_id) ?? null : null,
            })),
            total: rows.length,
            summary: { total_sent, total_opened, open_rate },
          };
        },
        listRecentSentEmails: async (userId, limit = 50) => {
          return sentEmails
            .filter((r) => r.user_id === userId)
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit);
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

    if (request.includes("services/outreach-send-smtp")) {
      const actual = originalLoad(request, parent, isMain);
      return {
        ...actual,
        sendOutreachEmail: async (payload) => {
          const failFor = process.env.MOCK_OUTREACH_SEND_FAIL_FOR?.trim();
          if (failFor && (failFor === payload.to || failFor === "throw")) {
            throw new Error("Mock outreach send failure");
          }
          lastSmtpPayloads.push({ ...payload });
          return `mock-${randomUUID()}`;
        },
      };
    }

    return originalLoad(request, parent, isMain);
  };
}
