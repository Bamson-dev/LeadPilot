import { queryPg, isPgConfigured } from "./pg-pool";
import { logger } from "../utils/logger";

type Filter =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "neq"; col: string; val: unknown }
  | { kind: "in"; col: string; vals: unknown[] }
  | { kind: "gte"; col: string; val: unknown }
  | { kind: "gt"; col: string; val: unknown }
  | { kind: "lt"; col: string; val: unknown }
  | { kind: "lte"; col: string; val: unknown }
  | { kind: "ilike"; col: string; pattern: string }
  | { kind: "isNull"; col: string }
  | { kind: "isNotNull"; col: string }
  | { kind: "contains"; col: string; vals: unknown[] }
  | { kind: "or"; filter: string };

type OrderBy = { col: string; ascending: boolean };

type UpsertOpts = { onConflict?: string; ignoreDuplicates?: boolean };

type QueryResult<T = unknown> = {
  data: T;
  error: { code: string; message: string } | null;
  count?: number | null;
};

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
  return `"${name}"`;
}

function quoteTable(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid table name: ${name}`);
  }
  return `"${name}"`;
}

/** node-pg returns timestamptz as Date; Supabase REST returns ISO strings. Normalize for app code. */
function normalizeCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeCell);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeCell(v)])
    );
  }
  return value;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, normalizeCell(v)])
  ) as Record<string, unknown>;
}

/** PostgREST column ref, e.g. `properties->>email_channel` → `properties->>'email_channel'`. */
function sqlColumnRef(col: string): string {
  const arrow = col.indexOf("->>");
  if (arrow !== -1) {
    const base = col.slice(0, arrow);
    const key = col.slice(arrow + 3).replace(/'/g, "''");
    return `${quoteIdent(base)}->>'${key}'`;
  }
  return quoteIdent(col);
}

/** Parse one PostgREST `.or()` clause token, e.g. `col.is.null` or `col.neq.value`. */
function parsePostgrestOrToken(token: string, params: unknown[]): string {
  if (token.endsWith(".is.null")) {
    return `${sqlColumnRef(token.slice(0, -".is.null".length))} is null`;
  }
  const neqAt = token.indexOf(".neq.");
  if (neqAt !== -1) {
    params.push(token.slice(neqAt + ".neq.".length));
    return `${sqlColumnRef(token.slice(0, neqAt))} <> $${params.length}`;
  }
  const eqAt = token.indexOf(".eq.");
  if (eqAt !== -1) {
    params.push(token.slice(eqAt + ".eq.".length));
    return `${sqlColumnRef(token.slice(0, eqAt))} = $${params.length}`;
  }
  throw new Error(`Unsupported PostgREST or token: ${token}`);
}

function buildOrClause(orFilter: string, params: unknown[]): string {
  const tokens = orFilter.split(",").map((t) => t.trim()).filter(Boolean);
  if (!tokens.length) return "true";
  return `(${tokens.map((t) => parsePostgrestOrToken(t, params)).join(" or ")})`;
}

function buildWhere(filters: Filter[], params: unknown[]): string {
  const parts: string[] = [];
  for (const f of filters) {
    if (f.kind === "or") {
      parts.push(buildOrClause(f.filter, params));
    } else if (f.kind === "contains") {
      params.push(f.vals);
      parts.push(`${quoteIdent(f.col)} @> $${params.length}::text[]`);
    } else if (f.kind === "eq") {
      params.push(f.val);
      parts.push(`${quoteIdent(f.col)} = $${params.length}`);
    } else if (f.kind === "in") {
      if (!f.vals.length) {
        parts.push("false");
        continue;
      }
      const placeholders = f.vals.map((v) => {
        params.push(v);
        return `$${params.length}`;
      });
      parts.push(`${quoteIdent(f.col)} in (${placeholders.join(", ")})`);
    } else if (f.kind === "gte") {
      params.push(f.val);
      parts.push(`${quoteIdent(f.col)} >= $${params.length}`);
    } else if (f.kind === "gt") {
      params.push(f.val);
      parts.push(`${quoteIdent(f.col)} > $${params.length}`);
    } else if (f.kind === "lt") {
      params.push(f.val);
      parts.push(`${quoteIdent(f.col)} < $${params.length}`);
    } else if (f.kind === "lte") {
      params.push(f.val);
      parts.push(`${quoteIdent(f.col)} <= $${params.length}`);
    } else if (f.kind === "neq") {
      params.push(f.val);
      parts.push(`${quoteIdent(f.col)} <> $${params.length}`);
    } else if (f.kind === "isNull") {
      parts.push(`${quoteIdent(f.col)} is null`);
    } else if (f.kind === "isNotNull") {
      parts.push(`${quoteIdent(f.col)} is not null`);
    } else if (f.kind === "ilike") {
      params.push(f.pattern);
      parts.push(`${quoteIdent(f.col)} ilike $${params.length}`);
    }
  }
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

export class PgQueryBuilder {
  private filters: Filter[] = [];
  private orderBy: OrderBy | null = null;
  private limitN: number | null = null;
  private offsetN: number | null = null;
  private selectCols = "*";
  private countOnly = false;
  private includeCount = false;

  constructor(private readonly table: string) {}

  select(columns = "*", opts?: { count?: string; head?: boolean }): this {
    if (opts?.count === "exact" && opts?.head) {
      this.countOnly = true;
      return this;
    }
    if (opts?.count === "exact") {
      this.includeCount = true;
    }
    this.selectCols = columns;
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push({ kind: "in", col, vals });
    return this;
  }

  gte(col: string, val: unknown): this {
    this.filters.push({ kind: "gte", col, val });
    return this;
  }

  gt(col: string, val: unknown): this {
    this.filters.push({ kind: "gt", col, val });
    return this;
  }

  lt(col: string, val: unknown): this {
    this.filters.push({ kind: "lt", col, val });
    return this;
  }

  lte(col: string, val: unknown): this {
    this.filters.push({ kind: "lte", col, val });
    return this;
  }

  neq(col: string, val: unknown): this {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }

  /** Supabase-style null checks: `.not(col, "is", null)` → IS NOT NULL */
  not(col: string, op: string, val: unknown): this {
    if (op === "is" && val === null) {
      this.filters.push({ kind: "isNotNull", col });
    } else if (op === "is" && val !== null) {
      this.filters.push({ kind: "isNull", col });
    }
    return this;
  }

  is(col: string, val: unknown): this {
    if (val === null) {
      this.filters.push({ kind: "isNull", col });
    }
    return this;
  }

  ilike(col: string, pattern: string): this {
    this.filters.push({ kind: "ilike", col, pattern });
    return this;
  }

  /** Array contains — `tags @> '{value}'` for text[] columns. */
  contains(col: string, vals: unknown[]): this {
    this.filters.push({ kind: "contains", col, vals });
    return this;
  }

  /** PostgREST-style OR filter string, e.g. `col.is.null,col.neq.value`. */
  or(filter: string): this {
    this.filters.push({ kind: "or", filter });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  /** Supabase `.range(from, to)` — inclusive end index. */
  range(from: number, to: number): this {
    this.offsetN = Math.max(0, from);
    this.limitN = Math.max(0, to - from + 1);
    return this;
  }

  private async runSelect(): Promise<QueryResult> {
    const params: unknown[] = [];
    const where = buildWhere(this.filters, params);
    const table = quoteTable(this.table);

    try {
      if (this.countOnly) {
        const rows = await queryPg<{ count: string }>(
          `select count(*)::text as count from ${table}${where}`,
          params
        );
        return { data: null, error: null, count: Number(rows[0]?.count ?? 0) };
      }

      let totalCount: number | null = null;
      if (this.includeCount) {
        const countRows = await queryPg<{ count: string }>(
          `select count(*)::text as count from ${table}${where}`,
          params
        );
        totalCount = Number(countRows[0]?.count ?? 0);
      }

      let sql = `select ${this.selectCols === "*" ? "*" : this.selectCols} from ${table}${where}`;
      if (this.orderBy) {
        sql += ` order by ${quoteIdent(this.orderBy.col)} ${this.orderBy.ascending ? "asc" : "desc"}`;
      }
      if (this.offsetN != null) {
        params.push(this.offsetN);
        sql += ` offset $${params.length}`;
      }
      if (this.limitN != null) {
        params.push(this.limitN);
        sql += ` limit $${params.length}`;
      }

      const rows = await queryPg<Record<string, unknown>>(sql, params);
      return {
        data: rows.map(normalizeRow),
        error: null,
        count: this.includeCount ? totalCount : null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "select failed";
      return { data: null, error: { code: "PG_ERROR", message }, count: null };
    }
  }

  async single(): Promise<QueryResult> {
    this.limitN = 2;
    const result = await this.runSelect();
    if (result.error) return result;
    const rows = (result.data as Record<string, unknown>[]) || [];
    if (rows.length === 0) {
      return { data: null, error: { code: "PGRST116", message: "0 rows" }, count: null };
    }
    if (rows.length > 1) {
      return { data: null, error: { code: "PGRST116", message: "multiple rows" }, count: null };
    }
    return { data: rows[0], error: null, count: null };
  }

  async maybeSingle(): Promise<QueryResult> {
    this.limitN = 1;
    const result = await this.runSelect();
    if (result.error) return result;
    const rows = (result.data as Record<string, unknown>[]) || [];
    return { data: rows[0] ?? null, error: null, count: null };
  }

  then(onfulfilled?: (value: QueryResult) => unknown, onrejected?: (reason: unknown) => unknown) {
    return this.runSelect().then(onfulfilled, onrejected);
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]): PgMutateBuilder {
    return new PgMutateBuilder(this.table, "insert", payload);
  }

  update(payload: Record<string, unknown>): PgMutateBuilder {
    return new PgMutateBuilder(this.table, "update", payload);
  }

  upsert(
    payload: Record<string, unknown> | Record<string, unknown>[],
    opts?: UpsertOpts
  ): PgMutateBuilder {
    return new PgMutateBuilder(this.table, "upsert", payload, opts);
  }

  delete(): PgMutateBuilder {
    return new PgMutateBuilder(this.table, "delete", {});
  }
}

class PgMutateBuilder {
  private filters: Filter[] = [];
  private selectCols: string | null = null;
  private singleResult = false;

  constructor(
    private readonly table: string,
    private readonly op: "insert" | "update" | "upsert" | "delete",
    private readonly payload: Record<string, unknown> | Record<string, unknown>[],
    private readonly upsertOpts?: UpsertOpts
  ) {}

  eq(col: string, val: unknown): this {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push({ kind: "in", col, vals });
    return this;
  }

  select(cols = "*"): this {
    this.selectCols = cols;
    return this;
  }

  single(): Promise<QueryResult> {
    this.singleResult = true;
    return this.execute();
  }

  maybeSingle(): Promise<QueryResult> {
    this.singleResult = true;
    return this.execute();
  }

  then(onfulfilled?: (value: QueryResult) => unknown, onrejected?: (reason: unknown) => unknown) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    const table = quoteTable(this.table);
    const params: unknown[] = [];

    try {
      if (this.op === "delete") {
        const where = buildWhere(this.filters, params);
        const returning = this.selectCols ? ` returning ${this.selectCols}` : "";
        const rows = await queryPg<Record<string, unknown>>(
          `delete from ${table}${where}${returning}`,
          params
        );
        if (rows === null) throw new Error("Postgres delete failed");
        return this.formatResult(rows);
      }

      const rowsPayload = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (this.op !== "update" && !rowsPayload.length) {
        return { data: [], error: null, count: 0 };
      }

      if (this.op === "insert") {
        const cols = Object.keys(rowsPayload[0]);
        const colList = cols.map(quoteIdent).join(", ");
        const allValues: unknown[] = [];
        const valueGroups: string[] = [];
        for (const row of rowsPayload) {
          const placeholders = cols.map((c) => {
            allValues.push(row[c]);
            return `$${allValues.length}`;
          });
          valueGroups.push(`(${placeholders.join(", ")})`);
        }
        const returning = this.selectCols ? ` returning ${this.selectCols}` : "";
        const sql = `insert into ${table} (${colList}) values ${valueGroups.join(", ")}${returning}`;
        const rows = await queryPg<Record<string, unknown>>(sql, allValues);
        if (rows === null) throw new Error("Postgres insert failed");
        return this.formatResult(rows);
      }

      if (this.op === "upsert") {
        const cols = Object.keys(rowsPayload[0]);
        const colList = cols.map(quoteIdent).join(", ");
        const allValues: unknown[] = [];
        const valueGroups: string[] = [];
        for (const row of rowsPayload) {
          const placeholders = cols.map((c) => {
            allValues.push(row[c]);
            return `$${allValues.length}`;
          });
          valueGroups.push(`(${placeholders.join(", ")})`);
        }
        const conflict = this.upsertOpts?.onConflict
          ?.split(",")
          .map((c) => quoteIdent(c.trim()))
          .join(", ");
        if (!conflict) throw new Error("upsert requires onConflict");
        const updates = cols
          .filter((c) => c !== "id")
          .map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`)
          .join(", ");
        const conflictClause = this.upsertOpts?.ignoreDuplicates
          ? ` on conflict (${conflict}) do nothing`
          : ` on conflict (${conflict}) do update set ${updates}`;
        const returning = this.selectCols ? ` returning ${this.selectCols}` : "";
        const sql = `insert into ${table} (${colList}) values ${valueGroups.join(", ")}${conflictClause}${returning}`;
        const rows = await queryPg<Record<string, unknown>>(sql, allValues);
        if (rows === null) throw new Error("Postgres upsert failed");
        return this.formatResult(rows);
      }

      const row = rowsPayload[0];
      const setParts = Object.entries(row).map(([col, val]) => {
        params.push(val);
        return `${quoteIdent(col)} = $${params.length}`;
      });
      const where = buildWhere(this.filters, params);
      const returning = this.selectCols ? ` returning ${this.selectCols}` : "";
      const rows = await queryPg<Record<string, unknown>>(
        `update ${table} set ${setParts.join(", ")}${where}${returning}`,
        params
      );
      if (rows === null) throw new Error("Postgres update failed");
      return this.formatResult(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "mutation failed";
      logger.error("[pg-query-builder] mutation failed", {
        table: this.table,
        op: this.op,
        message,
      });
      return { data: null, error: { code: "PG_ERROR", message }, count: null };
    }
  }

  private formatResult(rows: Record<string, unknown>[]): QueryResult {
    const normalized = rows.map(normalizeRow);
    if (this.selectCols) {
      if (this.singleResult) {
        return { data: normalized[0] ?? null, error: null, count: null };
      }
      return { data: normalized, error: null, count: normalized.length };
    }
    return { data: null, error: null, count: normalized.length };
  }
}

export function pgFrom(table: string): PgQueryBuilder {
  if (!isPgConfigured()) {
    throw new Error("Postgres not configured");
  }
  return new PgQueryBuilder(table);
}
