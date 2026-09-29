import "server-only";

import { AiError, type AiAnswer, type AiRequest, type Provider } from "./provider";

/**
 * Claude, over the Messages API.
 *
 * `fetch` rather than the SDK: this is one POST with a tool definition on it,
 * and the tool is how the Messages API does structured output. Asking for a
 * tool call with the schema as its input is more reliable than asking for JSON
 * in prose and parsing it.
 *
 * `cacheable` goes in its own system block with a cache control on it. That
 * block is the faction's unit list, which is the same on every run for a
 * faction and is most of the prompt.
 */
const URL = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

export const anthropic: Provider = {
  name: "anthropic",

  async run(request: AiRequest, model: string, signal: AbortSignal): Promise<AiAnswer> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new AiError("no_key", "ANTHROPIC_API_KEY is not set.");

    const started = Date.now();
    const system: Record<string, unknown>[] = [{ type: "text", text: request.system }];
    if (request.cacheable) {
      system.push({
        type: "text", text: request.cacheable,
        cache_control: { type: "ephemeral" },
      });
    }

    let response: Response;
    try {
      response = await fetch(URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens,
          system,
          messages: [{ role: "user", content: request.user }],
          // Forcing the tool is what makes the schema binding rather than
          // advisory: the model cannot answer in prose instead.
          tools: [{ name: "answer", description: "Return the analysis.",
                    input_schema: request.schema }],
          tool_choice: { type: "tool", name: "answer" },
        }),
      });
    } catch (error) {
      if (signal.aborted) throw new AiError("timeout", "The run was stopped.");
      throw new AiError("provider", String(error));
    }

    if (!response.ok) {
      throw new AiError("provider",
        `Anthropic answered ${response.status}: ${(await response.text()).slice(0, 400)}`);
    }

    const body = await response.json() as {
      content?: { type: string; input?: unknown }[];
      usage?: {
        input_tokens?: number; output_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };

    const call = body.content?.find((one) => one.type === "tool_use");
    if (!call?.input) {
      throw new AiError("unparseable", "No tool call came back.");
    }

    return {
      json: call.input,
      provider: "anthropic",
      model,
      tokensIn: body.usage?.input_tokens ?? 0,
      tokensOut: body.usage?.output_tokens ?? 0,
      tokensCached: body.usage?.cache_read_input_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  },
};
