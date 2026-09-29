/**
 * Why a run did not finish, in words the reader can act on.
 *
 * In `utils` rather than `lib/ai` because the client components need it: the
 * panel reads the failed job's own `error_code` and says what actually went
 * wrong. It shipped saying "try again" to everything, which is wrong for
 * exactly the cases somebody most needs to understand — no key and the kill
 * switch will fail identically for ever, and telling somebody to try again is
 * telling them to waste their afternoon.
 */

export type AiErrorKind =
  | "disabled"        // the kill switch, or the feature is off
  | "timeout"
  | "provider"        // it answered, badly or not at all
  | "unparseable"     // it answered with something that is not the schema
  | "no_key"
  | "lost";           // the sweep found it stuck

export const AI_ERROR_COPY: Record<AiErrorKind, string> = {
  disabled: "AI coaching is switched off on this deployment. The list health above is still current.",
  timeout: "That took too long and was stopped. Nothing was charged, so it is worth trying again.",
  provider: "The coaching service did not answer. Nothing was charged, so it is worth trying again.",
  unparseable: "The answer came back in a shape we could not read. Nothing was charged.",
  no_key: "AI coaching is not set up on this deployment yet, so there is nothing to try again. Everything above still works.",
  lost: "That run was stopped after five minutes without an answer. Nothing was charged.",
};

/** The database stores AI_LOST; everything else comes straight from the run. */
export function aiErrorCopy(code: string): string {
  const key = String(code ?? "").trim().toLowerCase().replace(/^ai_/, "");
  return AI_ERROR_COPY[key as AiErrorKind]
    ?? "That run did not finish, and nothing was charged for it.";
}
