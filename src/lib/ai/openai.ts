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
      output_text?: string;
      output?: { content?: { text?: string }[] }[];
      usage?: {
        input_tokens?: number; output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      };
    };

    const text = body.output_text
      ?? body.output?.[0]?.content?.[0]?.text
      ?? "";
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
