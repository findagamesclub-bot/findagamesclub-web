import { createClient } from "./server";
import type { Database } from "@/types/database";

/**
 * A table the generated types do not know about yet.
 *
 * `src/types/database.ts` is generated from the live schema, so a repository
 * written alongside a migration has nothing to type against until the user has
 * run it. Casting the whole client to `any` at each call site loses the query
 * shape as well; this keeps it, because the caller still declares the row type
 * it expects and every link in the chain is still checked.
 *
 * Stage 1 wrote this by hand inside `clubTeam.repository.ts` for the same
 * reason. It is here so the Stage 3 repositories share one copy.
 *
 * Delete a call to it as soon as the table reaches the generated types.
 */

/**
 * One generated row type, for hand-writing the shape a shimmed query returns.
 * Pick from it rather than using it whole: a column nobody selected must not
 * be readable as though it were there.
 */
export type TableRow<N extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][N]["Row"];

type Rows<T> = { data: T[] | null; error: { message: string } | null; count: number | null };
type One<T> = { data: T | null; error: { message: string } | null };

/**
 * A query being built.
 *
 * Thenable, because that is how PostgREST runs: awaiting the chain is what
 * sends it.
 */
export type Query<T> = PromiseLike<Rows<T>> & {
  select(columns?: string, options?: { count: "exact" }): Query<T>;
  eq(column: string, value: string | number | boolean): Query<T>;
  neq(column: string, value: string | number | boolean): Query<T>;
  in(column: string, values: (string | number)[]): Query<T>;
  is(column: string, value: null | boolean): Query<T>;
  gte(column: string, value: string | number): Query<T>;
  lte(column: string, value: string | number): Query<T>;
  lt(column: string, value: string | number): Query<T>;
  or(filter: string): Query<T>;
  not(column: string, operator: string, value: null | string | number): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  range(from: number, to: number): Query<T>;
  limit(count: number): Query<T>;
  maybeSingle(): PromiseLike<One<T>>;
  single(): PromiseLike<One<T>>;
};

/**
 * The table itself, which is deliberately NOT thenable: `await table(...)` has
 * to hand back something to build a query on, and a thenable would be unwrapped
 * by the await instead.
 */
export type Builder<T> = {
  select(columns?: string, options?: { count: "exact" }): Query<T>;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): Query<T>;
  update(values: Record<string, unknown>): Query<T>;
  delete(): Query<T>;
};

export async function table<T>(name: string): Promise<Builder<T>> {
  const supabase = await createClient();
  return (supabase as unknown as { from(n: string): Builder<T> }).from(name);
}

/** A function the generated types do not know about yet. Same deal. */
export async function callRpc<T>(
  name: string, args: Record<string, unknown> = {},
): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{
      data: unknown; error: { message: string } | null;
    }>;
  }).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
