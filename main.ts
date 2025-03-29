import { getRandomPort } from "get-port-please";
import { startTunnel } from "untun";
import { cli } from "cleye";
import terminalLink from "terminal-link";
import { bold, green, italic } from "yoctocolors";

import json from "./deno.json" with { type: "json" };
import { validateURL } from "./util.ts";
import { createApp } from "./proxy.ts";
import { ensure, is } from "@core/unknownutil";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const argv = cli({
  name: json.name.split("/").at(-1) as string,
  version: json.version,

  flags: {
    endpoint: {
      type: validateURL,
      alias: "e",
      default: "http://localhost:11434",
      description: "The endpoint to Ollama server.",
    },

    openaiEndpoint: {
      type: validateURL,
      alias: "o",
      default: "https://api.openai.com",
      description: "The endpoint to OpenAI server.",
    },

    port: {
      type: Number,
      alias: "p",
      default: await getRandomPort(),
      description: "The port to run the server on. Default is random",
    },

    hostname: {
      type: String,
      default: "127.0.0.1",
      description: "The hostname to run the server on.",
    },

    disableCloudflared: {
      type: Boolean,
      alias: "d",
      default: false,
      description: "Use cloudflared to tunnel the server",
    },
  },

  help: {
    description: "A proxy An proxy worker for using ollama in cursor",

    examples: [
      "curxy",

      "",

      "curxy --endpoint http://localhost:11434 --openai-endpoint https://api.openai.com --port 8800",

      "",

      "OPENAI_API_KEY=sk-123456 curxy --port 8800",
    ],
  },
});

const { flags } = argv;

if (import.meta.main) {
  const app = createApp({
    openAIEndpoint: flags.openaiEndpoint,
    ollamaEndpoint: flags.endpoint,
    OPENAI_API_KEY,
  });

  await Promise.all([
    Deno.serve({ port: flags.port, hostname: flags.hostname }, app.fetch),
    !flags.disableCloudflared &&
    startTunnel({ port: flags.port, hostname: flags.hostname })
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
}
