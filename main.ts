import { Hono } from "https://deno.land/x/hono@v4.2.5/mod.ts";
import { bearerAuth } from "https://deno.land/x/hono@v4.2.5/middleware.ts";
import { getRandomPort } from "npm:get-port-please@3.1.2";
import { type ParsedURL, parseURL } from "npm:ufo@1.5.3";
import { ensure, is, maybe } from "jsr:@core/unknownutil@3.18.0";
import { $ } from "jsr:@david/dax@0.40.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const ollamaEndpoint = maybe(Deno.args.at(0), is.String) ??
  "http://localhost:11434";

/**
 * Converts a URL to a local Ollama endpoint
 */
function convertToLocalOllamaEndpoint(url: string, endpoint: ParsedURL) {
  const _url = new URL(url);
  _url.protocol = ensure(endpoint.protocol, is.String);
  _url.host = ensure(endpoint.host, is.String);
  return _url.toString();
}

Deno.test("convertToOllamaEndpoint", async () => {
  const { assertEquals } = await import("jsr:@std/testing@0.222.1/asserts");

  const url = "https://api.openai.com/v1/chat/completions" as const;
  const result = convertToLocalOllamaEndpoint(
    url,
    parseURL("http://localhost:11434"),
  );
  assertEquals(result, "http://localhost:11434/v1/chat/completions");
});

/**
 * Chooses the appropriate endpoint based on the model name
 */
function chooseEndpoint(model: string) {
  switch (true) {
    case model.startsWith("gpt"):
      return "https://api.openai.com";
    default:
      return ollamaEndpoint;
  }
}

Deno.test("chooseEndpoint", async () => {
  const { assertEquals } = await import("jsr:@std/testing@0.222.1/asserts");

  assertEquals(chooseEndpoint("gpt-3.5"), "https://api.openai.com");
  assertEquals(chooseEndpoint("davinci"), "http://localhost:11434");
});

/** main **/
const app = new Hono();

if (is.String(OPENAI_API_KEY)) {
  app.use("*", bearerAuth({ token: OPENAI_API_KEY }));
}

app.post("*", async (c) => {
  const json = await c.req.raw.clone().json();
  /** if model name starts with "gpt" then it is a chat model */
  ensure(json.model, is.String);
  const endpoint = chooseEndpoint(json.model);

  const url = convertToLocalOllamaEndpoint(c.req.url, parseURL(endpoint));
  const req = new Request(url, c.req.raw);

  req.headers.set("Host", ollamaEndpoint);
  return fetch(req);
});

if (import.meta.main) {
  const port = await getRandomPort();
  const hostname = "localhost";
  const protocol = "http";
  const url = `${protocol}://${hostname}:${port}` as const;
  if (!URL.canParse(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  Deno.serve({ port, hostname }, app.fetch);
  await $`cloudflared tunnel --url ${url} --loglevel info`;
}
