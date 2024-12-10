import { Hono } from "@hono/hono";
import { bearerAuth } from "@hono/hono/bearer-auth";
import { assert, is } from "@core/unknownutil";
import { parseURL } from "ufo";
import { chooseEndpoint, convertToCustomEndpoint, isCursorRequest, isOpenAIModel } from "./util.ts";

/**
 * A class representing a proxy application that handles requests to OpenAI and Ollama endpoints.
 */
class ProxyApp {
  private openAIEndpoint: string;
  private ollamaEndpoint: string;
  private OPENAI_API_KEY: string | undefined;

  /**
   * Constructs a new instance of the ProxyApp class.
   * @param openAIEndpoint - The endpoint URL for OpenAI.
   * @param ollamaEndpoint - The endpoint URL for Ollama.
   * @param OPENAI_API_KEY - The API key for OpenAI (optional).
   */
  constructor(
    openAIEndpoint: string,
    ollamaEndpoint: string,
    OPENAI_API_KEY: string | undefined
  ) {
    this.openAIEndpoint = openAIEndpoint;
    this.ollamaEndpoint = ollamaEndpoint;
    this.OPENAI_API_KEY = OPENAI_API_KEY;
  }

  /**
   * Handles all incoming requests, including OPTIONS requests.
   * @param c - The context object containing request and response information.
   * @param next - A function to execute the next middleware in the chain.
   * @returns A Promise that resolves to the response object.
   */
  private handleAllRequest(c: any, next: () => Promise<any>): Response | Promise<void | Response> {
    if (c.req.method === "OPTIONS") {
      return this.handleOptionsRequest(c);
    }
    return bearerAuth({ token: this.OPENAI_API_KEY?.toString() || '' })(c, async () => {
      // Execute subsequent middleware
      await next();
      // Add CORS headers to the response
      if (c.res) {
        c.res = new Response(c.res.body, {
          status: c.res.status,
          headers: this.setCORSHeaders(c.res, c.req.raw.headers.get('origin'))
        });
      }
      return c.res;
    });
  }

  /**
   * Sets CORS headers for a given response.
   * @param res - The response object to which headers will be added.
   * @param origin - The origin of the request.
   * @returns A Headers object with CORS headers set.
   */
  private setCORSHeaders(res: Response, origin: string): Headers {
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', origin || '*');
    headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');
    return headers;
  }
  /**
   * 处理验证请求的模型
   * @param c 
   * @param json 
   * @returns 
   */
  private async handleOpenAIModelVerify(c: any, json: any) {
    if (this.isVerifyRequest(c, json)) {
      const models = await this.getModulesList()
      const modelName = models.find((model: any) => model.name === json.model)?.name || models[0]?.name;
      if (modelName) {
        json.model = modelName;
        return null;
      }else{
        console.error(`Ollama Model not found: ${json.model}`);
        return new Response(JSON.stringify({ error: "Model not found" }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
  /**
   * 验证是否是Cursor的请求
   * @param c 
   * @param json 
   * @returns 
   */
  private isVerifyRequest(c: any, json: any) {
    const origin = c.req.raw.headers.get('Origin');
    return isOpenAIModel(json.model) && isCursorRequest(origin) && json.stream === false;
  }
  /**
   * Handles POST requests.
   * @param c - The context object containing request and response information.
   * @returns A Promise that resolves to the response object.
   */
  private async handlePostRequest(c: any): Promise<Response> {
    const json = await c.req.raw.clone().json();
    assert(json, is.ObjectOf({ model: is.String }));
    const endpoint = chooseEndpoint({
      model: json.model,
      ollamaEndpoint: this.ollamaEndpoint,
      openAIEndpoint: this.openAIEndpoint,
    });

    let res = await this.handleOpenAIModelVerify(c, json);
    if (res) {
      return res;
    }

    const origin = new URL(this.ollamaEndpoint).origin;
    const url = convertToCustomEndpoint(c.req.url, parseURL(endpoint));
    const reqHeaders = this.setCORSHeaders(c.req.raw, origin);
    // 设置Origin头, 否则ollama会报错
    reqHeaders.set('Origin', origin);
    const req = new Request(url, {
      ...c.req.raw,
      method: "POST",
      body: JSON.stringify(json),
      headers: reqHeaders,
      mode: 'no-cors'
    });
    return fetch(req)
  }
  /**
   * Handles GET requests.
   * @param c - The context object containing request and response information.
   * @returns A Promise that resolves to the response object.
   */
  private async handleGetRequest(c: any): Promise<Response> {
    const path = new URL(c.req.url).pathname;
    if (path === '/v1/models') {
      try {
        const models = await this.getModulesList();
        const headers = this.setCORSHeaders(c.req.raw, c.req.raw.headers.get('origin'));

        const formattedResponse = {
          object: "list",
          data: models.map((model: any) => ({
            id: model.name,
            object: "model",
            created: Date.now(),
            owned_by: "ollama"
          }))
        };

        return new Response(JSON.stringify(formattedResponse), {
          status: 200,
          headers: headers
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const url = convertToCustomEndpoint(c.req.url, parseURL(this.ollamaEndpoint));
    const req = new Request(url, c.req.raw);
    req.headers.set("Host", this.ollamaEndpoint);
    return fetch(req);
  }

  /**
   * Handles OPTIONS requests.
   * @param c - The context object containing request and response information.
   * @returns A Response object with CORS headers set.
   */
  private handleOptionsRequest(c: any): Response {
    return new Response(null, {
      status: 204,
      headers: this.setCORSHeaders(c.req.raw, c.req.raw.headers.get('origin'))
    });
  }

  /**
   * Fetches the list of models from the Ollama endpoint.
   * @returns A Promise that resolves to an array of model objects.
   */
  private async getModulesList(): Promise<any[]> {
    const url = `${this.ollamaEndpoint}/api/tags`;
    const req = new Request(url, {
      method: 'GET',
      headers: new Headers({
        'Accept': 'application/json',
      })
    });

    try {
      const res = await fetch(req);
      const data = await res.json();
      return data.models || [];
    } catch (error) {
      console.error("Failed to fetch models:", error);
      throw new Error("Failed to fetch models");
    }
  }

  /**
   * Creates and returns a Hono application instance.
   * @returns A Hono application instance.
   */
  public createApp(): Hono {
    const app = new Hono();
    app.use('*', async (c: any, next: () => Promise<any>) => {
      // For OPTIONS requests, directly return
      return this.handleAllRequest(c, next);
    });

    app.post('*', (c: any) => {
      return this.handlePostRequest(c);
    });

    app.get('*', (c: any) => {
      return this.handleGetRequest(c);
    });

    return app;
  }
}

export default ProxyApp;
