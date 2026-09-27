export interface QueryResultLike {
  rows: unknown[];
  rowCount: number | null;
}

export interface PoolLike {
  query(sql: string, values?: unknown[]): Promise<QueryResultLike>;
  end(): Promise<void>;
}
