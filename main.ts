import { Hono } from "@hono/hono";
import { bearerAuth } from "@hono/hono/bearer-auth";
import { getRandomPort } from "get-port-please";
import { type ParsedURL, parseURL } from "ufo";
import { ensure, is, maybe } from "@core/unknownutil";
import { match, placeholder as _ } from "@core/match";
import { $ } from "@david/dax";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const ollamaEndpoint = maybe(Deno.args.at(0), is.String) ??
  "http://localhost:11434";

const OPENAI_ENDPOINT = "https://api.openai.com" as const;

/**
 * Converts a URL to a local Ollama endpoint
 */
function convertToCustomEndpoint(url: string, endpoint: ParsedURL) {
  const _url = new URL(url);
  _url.protocol = ensure(endpoint.protocol, is.String);
  _url.host = ensure(endpoint.host, is.String);
  return _url.toString();
}

Deno.test("convertToOllamaEndpoint", async () => {
  const { assertEquals } = await import("jsr:@std/testing@0.222.1/asserts");

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
function chooseEndpoint(model: string) {
  if (match(_`gpt-${_("v")}`, model) != null) return OPENAI_ENDPOINT;
  return ollamaEndpoint;
}

Deno.test("chooseEndpoint", async () => {
  const { assertEquals } = await import("jsr:@std/testing@0.222.1/asserts");

  assertEquals(chooseEndpoint("gpt-3.5"), "https://api.openai.com");
  assertEquals(chooseEndpoint("gpt-3.5-turbo"), "https://api.openai.com");
  assertEquals(chooseEndpoint("gpt-4-turbo"), "https://api.openai.com");
  assertEquals(chooseEndpoint("gpt-4-1106-preview"), "https://api.openai.com");
  assertEquals(chooseEndpoint("llama3"), "http://localhost:11434");
  assertEquals(chooseEndpoint("mistral-7b-b1.58"), "http://localhost:11434");
  assertEquals(chooseEndpoint("command-r:35b"), "http://localhost:11434");
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

  const url = convertToCustomEndpoint(c.req.url, parseURL(endpoint));
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
