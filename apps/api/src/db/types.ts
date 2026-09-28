export interface QueryResultLike {
  rows: unknown[];
  rowCount: number | null;
}

/**
 * A single checked-out connection. Transaction state lives on the connection,
 * not on the pool, so anything that wraps several statements in BEGIN/COMMIT
 * must hold one of these rather than calling PoolLike#query repeatedly.
 */
export interface ClientLike {
  query(sql: string, values?: unknown[]): Promise<QueryResultLike>;
  release(): void;
}

export interface PoolLike {
  query(sql: string, values?: unknown[]): Promise<QueryResultLike>;
  connect(): Promise<ClientLike>;
  end(): Promise<void>;
}
