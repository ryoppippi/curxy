import { Hono } from "@hono/hono";
import { bearerAuth } from "@hono/hono/bearer-auth";
import { assert, is } from "@core/unknownutil";
import { parseURL } from "ufo";

import { chooseEndpoint, convertToCustomEndpoint } from "./util.ts";

export function createApp(
  {
    openAIEndpoint,
    ollamaEndpoint,
    OPENAI_API_KEY,
  }: {
    openAIEndpoint: string;
    ollamaEndpoint: string;
    OPENAI_API_KEY: string | undefined;
  },
) {
  const app = new Hono();

  if (is.String(OPENAI_API_KEY)) {
    app.use("*", bearerAuth({ token: OPENAI_API_KEY }));
  }

  app.post("*", async (c) => {
    const json = await c.req.raw.clone().json();
    const { model } = json;
    /** if model name starts with "gpt" then it is a chat model */
    assert(json, is.ObjectOf({ model: is.String }));
    const endpoint = chooseEndpoint({
      model,
      ollamaEndpoint,
      openAIEndpoint,
    });

    const url = convertToCustomEndpoint(c.req.url, parseURL(endpoint));
    const req = new Request(url, c.req.raw);

    req.headers.set("Host", ollamaEndpoint);
    return fetch(req);
  });

  return app;
}
