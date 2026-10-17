import "server-only";

import { AiError, type AiAnswer, type AiRequest, type Provider } from "./provider";

/**
 * OpenAI, over the Responses API.
 *
 * Legacy's own path (`OPENAI_RESPONSES_URL`, server.py:183), kept so the
 * client can move back by setting one env var if they ever want to compare.
 * `AI_PROVIDER=openai` is the whole switch.
 *
 * `json_schema` with `strict` is this API's structured output, which is the
 * same job the forced tool call does on the other one.
 */
const URL = process.env.OPENAI_RESPONSES_URL
  || "https://api.openai.com/v1/responses";

export const openai: Provider = {
  name: "openai",

  async run(request: AiRequest, model: string, signal: AbortSignal): Promise<AiAnswer> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new AiError("no_key", "OPENAI_API_KEY is not set.");

    const started = Date.now();
    const system = [request.system, request.cacheable].filter(Boolean).join("\n\n");

    let response: Response;
    try {
      response = await fetch(URL, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_output_tokens: request.maxTokens,
          // The gpt-5 family thinks before it writes and bills that thinking
          // as output. The evidence here is already worked out in code and
          // the model is writing it up, which is the same reasoning legacy
          // used to put the small model on the list coach, so a low effort
          // leaves the budget for the answer rather than spending it on the
          // way there. Ignored by any model that does not reason.
          reasoning: { effort: "low" },
          input: [
            { role: "system", content: system },
            { role: "user", content: request.user },
          ],
          text: {
            format: {
              type: "json_schema", name: "answer",
              schema: request.schema, strict: true,
            },
          },
        }),
      });
    } catch (error) {
      if (signal.aborted) throw new AiError("timeout", "The run was stopped.");
      throw new AiError("provider", String(error));
    }

    if (!response.ok) {
      throw new AiError("provider",
        `OpenAI answered ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }

    const body = await response.json() as {
      status?: string;
      incomplete_details?: { reason?: string } | null;
      output_text?: string | null;
      output?: { type?: string; content?: { type?: string; text?: string }[] }[];
      usage?: {
        input_tokens?: number; output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      };
    };

    // The budget went on thinking and the answer never got written. Its own
    // error, because "nothing came back to parse" sends somebody looking at
    // the schema for a fault that is a number in `MAX_TOKENS`.
    if (body.status && body.status !== "completed") {
      throw new AiError("provider",
        `OpenAI stopped at "${body.status}"`
        + `${body.incomplete_details?.reason ? `: ${body.incomplete_details.reason}` : ""}.`);
    }

    // Every item, not the first one. `output_text` is a convenience the SDKs
    // assemble and is **null** over plain HTTP, and a reasoning model puts a
    // `reasoning` item at output[0] with the message behind it, so reading
    // `output[0].content[0].text` found nothing and every run came back as
    // "the answer came back in a shape we could not read". Measured against
    // gpt-5-mini: output[0] is reasoning, output[1] is the message, and
    // output_text is null.
    const text = body.output_text
      || body.output
        ?.flatMap((item) => item.content ?? [])
        .find((part) => typeof part.text === "string" && part.text.length > 0)
        ?.text
      || "";
    if (!text) throw new AiError("unparseable", "Nothing came back to parse.");

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError("unparseable", "The answer was not JSON.");
    }

    return {
      json,
      provider: "openai",
      model,
      tokensIn: body.usage?.input_tokens ?? 0,
      tokensOut: body.usage?.output_tokens ?? 0,
      tokensCached: body.usage?.input_tokens_details?.cached_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  },
};
