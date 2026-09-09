/**
 * Kysely dialect for Better Auth over the Neon HTTP driver
 * (`@neondatabase/serverless`).
 *
 * Why this exists: on Cloudflare Workers a TCP socket opened during one request
 * may not be used by another, so a globally-memoized node-postgres `Pool`
 * (Better Auth's default when handed a `Pool`) hangs on warm isolates — the
 * Workers runtime cancels the request with "your Worker's code had hung". The
 * Neon HTTP driver issues each query as an independent stateless HTTPS fetch, so
 * there is no cross-request socket to reuse. It also runs unchanged on Node.
 *
 * The trade-off is that HTTP queries autocommit individually: an interactive
 * BEGIN/COMMIT spanning multiple statements is not possible over the stateless
 * driver, so the transaction hooks below are no-ops. Better Auth's writes are
 * single statements, so this does not change observable behaviour; it only means
 * a multi-statement failure would not roll back (acceptable for auth writes).
 */
import { neon } from "@neondatabase/serverless";
import {
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  type CompiledQuery,
} from "kysely";

type NeonSql = ReturnType<typeof neon<false, true>>;

export function neonHttpDialect(connectionString: string): Dialect {
  const sql = neon(connectionString, { fullResults: true });
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new NeonHttpDriver(sql),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector =>
      new PostgresIntrospector(db),
  };
}

class NeonHttpDriver implements Driver {
  constructor(private readonly sql: NeonSql) {}

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    // Stateless: no pool, no per-connection socket to guard, safe to hand out a
    // fresh lightweight wrapper for every acquire (concurrent-safe).
    return new NeonHttpConnection(this.sql);
  }

  // Stateless HTTP autocommits each statement; there is no interactive
  // transaction to open/commit/roll back. See file header.
  async beginTransaction(): Promise<void> {}
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}

  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

class NeonHttpConnection implements DatabaseConnection {
  constructor(private readonly sql: NeonSql) {}

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const result = await this.sql.query(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    const rows = (result.rows ?? []) as O[];
    const rowCount = result.rowCount;
    if (typeof rowCount === "number") {
      return { numAffectedRows: BigInt(rowCount), rows };
    }
    return { rows };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await this.sql.query(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    const rows = (result.rows ?? []) as O[];
    for (let i = 0; i < rows.length; i += chunkSize) {
      yield { rows: rows.slice(i, i + chunkSize) };
    }
  }
}
