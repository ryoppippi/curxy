import { type ParsedURL, parseURL } from "ufo";
import { match, placeholder as _ } from "@core/match";
import { assert, ensure, is } from "@core/unknownutil";

/**
 * Validates a URL
 */
export function validateURL(url: string) {
  assert(url, is.String);

  if (!URL.canParse(url)) {
    throw new Error("Invalid URL");
  }

  return url;
}

/**
 * Converts a URL to a local Ollama endpoint
 */
export function convertToCustomEndpoint(
  url: string,
  endpoint: ParsedURL,
): string {
  const _url = new URL(url);
  _url.protocol = ensure(endpoint.protocol, is.String);
  _url.host = ensure(endpoint.host, is.String);
  return _url.toString();
}

Deno.test("convertToOllamaEndpoint", async () => {
  const { assertEquals } = await import("jsr:@std/assert@1.0.6");

  const url = "https://api.openai.com/v1/chat/completions" as const;
  const result = convertToCustomEndpoint(
    url,
    parseURL("http://localhost:11434"),
  );
  assertEquals(result, "http://localhost:11434/v1/chat/completions");
});

/**
 * Chooses the appropriate endpoint based on the model name
 */
export function chooseEndpoint(
  {
    model,
    ollamaEndpoint,
    openAIEndpoint,
  }: {
    model: string;
    ollamaEndpoint: string;
    openAIEndpoint: string;
  },
): string {
  if (match(_`gpt-${_("v")}`, model) != null) {
    return openAIEndpoint;
  }
  return ollamaEndpoint;
}

Deno.test("chooseEndpoint", async () => {
  const { assertEquals } = await import("jsr:@std/assert@1.0.6");

  const basseOption = {
    ollamaEndpoint: "http://localhost:11434",
    openAIEndpoint: "https://api.openai.com",
  };

  assertEquals(
    chooseEndpoint({
      model: "gpt-3.5",
      ...basseOption,
    }),
    "https://api.openai.com",
  );
  assertEquals(
    chooseEndpoint({
      model: "gpt-3.5-turbo",
      ...basseOption,
    }),
    "https://api.openai.com",
  );
  assertEquals(
    chooseEndpoint({
      model: "gpt-4-turbo",
      ...basseOption,
    }),
    "https://api.openai.com",
  );
  assertEquals(
    chooseEndpoint({
      model: "gpt-4-1106-preview",
      ...basseOption,
    }),
    "https://api.openai.com",
  );
  assertEquals(
    chooseEndpoint({
      model: "llama3",
      ...basseOption,
    }),
    "http://localhost:11434",
  );
  assertEquals(
    chooseEndpoint({
      model: "mistral-7b-b1.58",
      ...basseOption,
    }),
    "http://localhost:11434",
  );
  assertEquals(
    chooseEndpoint({
      model: "command-r:35b",
      ...basseOption,
    }),
    "http://localhost:11434",
  );
});
