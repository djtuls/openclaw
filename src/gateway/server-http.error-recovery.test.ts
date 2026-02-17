import { type IncomingMessage, type ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHooksRequestHandler, createGatewayHttpServer } from "./server-http.js";

// ---------------------------------------------------------------------------
// Minimal fakes
// ---------------------------------------------------------------------------

function makeFakeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";
  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(v: number) {
      statusCode = v;
    },
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      body = chunk ?? "";
    },
    get body() {
      return body;
    },
    parsedBody(): unknown {
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    },
  } as unknown as ServerResponse & {
    body: string;
    headers: Record<string, string>;
    parsedBody(): unknown;
  };
  return res;
}

function makeFakeReq(opts: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  socket?: { remoteAddress?: string };
}): IncomingMessage {
  const { url = "/", method = "GET", headers = {}, socket = { remoteAddress: "127.0.0.1" } } = opts;
  return { url, method, headers, socket } as unknown as IncomingMessage;
}

// ---------------------------------------------------------------------------
// createHooksRequestHandler – error response format tests
// ---------------------------------------------------------------------------

describe("createHooksRequestHandler error responses", () => {
  const baseOpts = {
    getHooksConfig: () => ({
      basePath: "/hooks",
      token: "secret",
      maxBodyBytes: 1_000,
      mappings: [],
      allowedAgents: [],
      sessionKey: undefined,
    }),
    bindHost: "127.0.0.1",
    port: 3000,
    logHooks: {
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    } as unknown as ReturnType<(typeof import("../logging/subsystem.js"))["createSubsystemLogger"]>,
    dispatchWakeHook: vi.fn(),
    dispatchAgentHook: vi.fn().mockReturnValue("run-id"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns JSON 400 with code TOKEN_IN_QUERY_PARAM when token is in query string", async () => {
    const handler = createHooksRequestHandler(baseOpts);
    const req = makeFakeReq({ url: "/hooks/wake?token=secret", method: "POST" });
    const res = makeFakeRes();

    const handled = await handler(req, res as unknown as ServerResponse);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { error: string; code: string };
    expect(body.code).toBe("TOKEN_IN_QUERY_PARAM");
    expect(typeof body.error).toBe("string");
  });

  it("returns JSON 401 with code UNAUTHORIZED on bad token", async () => {
    const handler = createHooksRequestHandler(baseOpts);
    const req = makeFakeReq({
      url: "/hooks/wake",
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });
    const res = makeFakeRes();

    const handled = await handler(req, res as unknown as ServerResponse);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(401);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { error: string; code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns JSON 405 with code METHOD_NOT_ALLOWED for non-POST", async () => {
    const handler = createHooksRequestHandler(baseOpts);
    const req = makeFakeReq({
      url: "/hooks/wake",
      method: "GET",
      headers: { authorization: "Bearer secret" },
    });
    const res = makeFakeRes();

    const handled = await handler(req, res as unknown as ServerResponse);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(405);
    expect(res.headers["allow"]).toBe("POST");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { error: string; code: string };
    expect(body.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("returns JSON 404 with code NOT_FOUND when subPath is empty", async () => {
    const handler = createHooksRequestHandler(baseOpts);
    // basePath is "/hooks", request to "/hooks" exactly — no subPath
    const req = makeFakeReq({
      url: "/hooks",
      method: "POST",
      headers: { authorization: "Bearer secret" },
    });
    const res = makeFakeRes();

    const handled = await handler(req, res as unknown as ServerResponse);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { error: string; code: string };
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns JSON 404 with code NOT_FOUND for unknown subPath", async () => {
    const handler = createHooksRequestHandler(baseOpts);
    // Use a real Readable stream so readJsonBody's req.on("data",...) works
    const bodyBuffer = Buffer.from(JSON.stringify({ text: "hi" }));
    const fakeReq = Object.assign(Readable.from([bodyBuffer]), {
      url: "/hooks/unknown-endpoint",
      method: "POST",
      headers: { authorization: "Bearer secret" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    const res = makeFakeRes();

    const handled = await handler(
      fakeReq as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    );

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(404);
    const body = res.parsedBody() as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns JSON 429 with code RATE_LIMITED after exceeding auth failure limit", async () => {
    const handler = createHooksRequestHandler(baseOpts);

    // Exhaust the rate limit (20 failures within the window)
    for (let i = 0; i < 20; i++) {
      const r = makeFakeReq({
        url: "/hooks/wake",
        method: "POST",
        headers: { authorization: "Bearer wrong" },
        socket: { remoteAddress: "10.0.0.1" },
      });
      const s = makeFakeRes();
      await handler(r, s as unknown as ServerResponse);
    }

    // 21st attempt should be throttled
    const req = makeFakeReq({
      url: "/hooks/wake",
      method: "POST",
      headers: { authorization: "Bearer wrong" },
      socket: { remoteAddress: "10.0.0.1" },
    });
    const res = makeFakeRes();
    const handled = await handler(req, res as unknown as ServerResponse);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(429);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { code: string };
    expect(body.code).toBe("RATE_LIMITED");
  });
});

// ---------------------------------------------------------------------------
// createGatewayHttpServer – 500 catch block returns JSON
// ---------------------------------------------------------------------------

describe("createGatewayHttpServer handleRequest 500 error recovery", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns JSON 500 with code INTERNAL_ERROR when a handler throws", async () => {
    const throwingHookHandler = vi.fn().mockRejectedValue(new Error("boom"));

    const server = createGatewayHttpServer({
      canvasHost: null,
      clients: new Set(),
      controlUiEnabled: false,
      controlUiBasePath: "/ui",
      openAiChatCompletionsEnabled: false,
      openResponsesEnabled: false,
      handleHooksRequest: throwingHookHandler,
      resolvedAuth: { auth: "none" } as unknown as import("./auth.js").ResolvedGatewayAuth,
    });

    // Create a minimal fake req/res and invoke the request listener directly
    const req = makeFakeReq({ url: "/hooks/wake", method: "POST" });
    const res = makeFakeRes();

    // Access the listener registered on the server
    const listeners = server.listeners("request") as Array<
      (req: IncomingMessage, res: ServerResponse) => void
    >;
    expect(listeners.length).toBeGreaterThan(0);

    // The actual listener wraps handleRequest in `void handleRequest(...)`,
    // so we need to give it a tick to settle.
    listeners[0](req, res as unknown as ServerResponse);
    // Wait for the async handleRequest to complete
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.statusCode).toBe(500);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { error: string; code: string };
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.error).toBe("Internal Server Error");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[gateway] Unhandled error in handleRequest:",
      expect.stringContaining("boom"),
    );
  });

  it("returns JSON 404 with code NOT_FOUND for unmatched routes", async () => {
    const noopHandler = vi.fn().mockResolvedValue(false);

    const server = createGatewayHttpServer({
      canvasHost: null,
      clients: new Set(),
      controlUiEnabled: false,
      controlUiBasePath: "/ui",
      openAiChatCompletionsEnabled: false,
      openResponsesEnabled: false,
      handleHooksRequest: noopHandler,
      resolvedAuth: { auth: "none" } as unknown as import("./auth.js").ResolvedGatewayAuth,
    });

    const req = makeFakeReq({ url: "/nonexistent", method: "GET" });
    const res = makeFakeRes();

    const listeners = server.listeners("request") as Array<
      (req: IncomingMessage, res: ServerResponse) => void
    >;
    listeners[0](req, res as unknown as ServerResponse);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    const body = res.parsedBody() as { error: string; code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});
