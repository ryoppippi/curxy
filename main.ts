import process from "node:process";
import { getRandomPort } from "get-port-please";
import { startTunnel } from "untun";
import { cli, define } from "gunshi";
import terminalLink from "terminal-link";
import { bold, green, italic } from "yoctocolors";

import json from "./deno.json" with { type: "json" };
import { validateURL } from "./util.ts";
import { createApp } from "./proxy.ts";
import { ensure, is } from "@core/unknownutil";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const command = define({
  toKebab: true,
  args: {
    endpoint: {
      type: "custom",
      alias: "e",
      default: "http://localhost:11434",
      description: "The endpoint to Ollama server.",
      parse: validateURL,
    },
    openaiEndpoint: {
      type: "custom",
      alias: "o",
      default: "https://api.openai.com",
      description: "The endpoint to OpenAI server.",
      parse: validateURL,
    },
    port: {
      type: "number",
      alias: "p",
      default: await getRandomPort(),
      description: "The port to run the server on. Default is random",
    },
    hostname: {
      type: "string",
      default: "127.0.0.1",
      description: "The hostname to run the server on.",
    },
    cloudflared: {
      type: "boolean",
      alias: "c",
      default: true,
      negatable: true,
      description: "Use cloudflared to tunnel the server",
    },
  },
  examples: [
    "curxy",

    "",

    "curxy --endpoint http://localhost:11434 --openai-endpoint https://api.openai.com --port 8800",

    "",

    "OPENAI_API_KEY=sk-123456 curxy --port 8800",
  ].join("\n"),

  async run(ctx) {
    const app = createApp({
      openAIEndpoint: ctx.values.openaiEndpoint,
      ollamaEndpoint: ctx.values.endpoint,
      OPENAI_API_KEY,
    });

    await Promise.all([
      Deno.serve(
        { port: ctx.values.port, hostname: ctx.values.hostname },
        app.fetch,
      ),
      ctx.values.cloudflared &&
      startTunnel({ port: ctx.values.port, hostname: ctx.values.hostname })
        .then(async (tunnel) => ensure(await tunnel?.getURL(), is.String))
        .then((url) =>
          console.log(
            `Server running at: ${bold(terminalLink(url, url))}\n`,
            green(
              `enter ${bold(terminalLink(`${url}/v1`, `${url}/v1`))} into ${
                italic(`Override OpenAl Base URL`)
              } section in cursor settings`,
            ),
          )
        ),
    ]);
  },
});

if (import.meta.main) {
  await cli(process.argv.slice(2), command, {
    name: json.name.split("/").at(-1) as string,
    description: "A proxy worker for using ollama in cursor",
    version: json.version,
  });
}
