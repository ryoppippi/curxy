# curxy

#### _cursor_ + _proxy_ = **curxy**

[![JSR](https://jsr.io/badges/@ryoppippi/curxy)](https://jsr.io/@ryoppippi/curxy)
[![JSR](https://jsr.io/badges/@ryoppippi/curxy/score)](https://jsr.io/@ryoppippi/curxy)

An proxy worker for using ollama in cursor

## What is this?

This is a proxy worker for using ollama in cursor. It is a simple server that
forwards requests to the ollama server and returns the response.

## Why do you need this?

When we use llm prediction on cusor editor, the editor sends to the data to the
official cursor server, and the server sends the data to the ollama server.
Therefore, even if the endpoint is set to localhost in the cursor editor
configuration, the cursor server cannot send communication to the local server.
So, we need a proxy worker that can forward the data to the ollama server.

## requirements

- deno
- ollama server

## How to use

1. Launch the ollama server

2. Launch curxy

   ```sh
   deno run -A jsr:@ryoppippi/curxy
   ```

   if you limit the access to the ollama server, you can set `OPENAI_API_KEY`
   environment variable.

   ```bash
   OPENAI_API_KEY=your_openai_api_key deno run -A jsr:@ryoppippi/curxy

   Listening on http://127.0.0.1:62192/
   ◐ Starting cloudflared tunnel to http://127.0.0.1:62192                                                                                                                                                                                                                                                           5:39:59 PM
   Server running at: https://remaining-chen-composition-dressed.trycloudflare.com
   ```

   You can get the public URL hosted by cloudflare.

3. Enter the URL provided by cloudflared with /v1 appended to it into the
   Endpoint field under the OpenAI API Key in Cursor Editor.\
   Then, add the name of the model you want to use in the Model Names section,
   and you’ll be able to use any model running on Ollama.

   (Additionally, if you want to restrict access to this Proxy Server for
   security reasons, you can set the OPENAI_API_KEY as an environment variable,
   which will enable access restrictions based on the key.)”

![cursor](https://github.com/user-attachments/assets/83a54310-0728-49d8-8c3f-b31e0d8e3e1b)

## Related

[Japanese Article](https://zenn.dev/ryoppippi/articles/02c618452a1c9f)

## License

MIT
