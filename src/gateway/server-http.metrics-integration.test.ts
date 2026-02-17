import { type IncomingMessage, type ServerResponse } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cacheStats } from "../metrics/cache-stats.js";
import { metrics } from "../metrics/collector.js";
import { resetAllRateLimits } from "../middleware/rate-limiter.js";
import { createGatewayHttpServer } from "./server-http.js";

// ---------------------------------------------------------------------------
// Helpers (same pattern as server-http.error-recovery.test.ts)
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

/** Create a test server and return the request listener for direct invocation. */
function createTestServer(overrides?: { handleHooksRequest?: ReturnType<typeof vi.fn> }) {
  const handleHooksRequest = overrides?.handleHooksRequest ?? vi.fn().mockResolvedValue(false);

  const server = createGatewayHttpServer({
    canvasHost: null,
    clients: new Set(),
    controlUiEnabled: false,
    controlUiBasePath: "/ui",
    openAiChatCompletionsEnabled: false,
    openResponsesEnabled: false,
    handleHooksRequest,
    resolvedAuth: {
      auth: "none",
    } as unknown as import("./auth.js").ResolvedGatewayAuth,
  });

  const listeners = server.listeners("request") as Array<
    (req: IncomingMessage, res: ServerResponse) => void
  >;
  const listener = listeners[0];

  return { server, listener, handleHooksRequest };
}

/** Fire request and wait one tick for async handleRequest to settle. */
async function fireRequest(
  listener: (req: IncomingMessage, res: ServerResponse) => void,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  listener(req, res);
  await new Promise<void>((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("server-http metrics & rate-limiting integration", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    metrics.reset();
    cacheStats.reset();
    resetAllRateLimits();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // ── GET /metrics endpoint ───────────────────────────────────────────────

  describe("GET /metrics endpoint", () => {
    it("returns 200 with combined metrics + cache stats", async () => {
      const { listener } = createTestServer();
      const req = makeFakeReq({ url: "/metrics", method: "GET" });
      const res = makeFakeRes();

      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/);

      const body = res.parsedBody() as Record<string, unknown>;
      // MetricsSnapshot fields
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("uptimeMs");
      expect(body).toHaveProperty("memorySearch");
      expect(body).toHaveProperty("routing");
      expect(body).toHaveProperty("apiCalls");
      expect(body).toHaveProperty("counters");
      // Cache stats merged in
      expect(body).toHaveProperty("cache");
      const cache = body.cache as Record<string, unknown>;
      expect(cache).toHaveProperty("totalHits");
      expect(cache).toHaveProperty("totalMisses");
      expect(cache).toHaveProperty("hitRate");
    });

    it("is reachable even without rate-limit headroom", async () => {
      // Exhaust rate limit for the /metrics channel from this IP
      const { listener } = createTestServer();

      // Send 100 requests to exhaust per-channel limit on "metrics" channel
      for (let i = 0; i < 100; i++) {
        const r = makeFakeReq({ url: "/some-path", method: "GET" });
        const s = makeFakeRes();
        await fireRequest(listener, r, s as unknown as ServerResponse);
      }

      // /metrics should still respond 200 (it's checked before rate limiting)
      const req = makeFakeReq({ url: "/metrics", method: "GET" });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(200);
    });
  });

  // ── Rate limiting ──────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 with retryAfterMs when per-user limit is exceeded", async () => {
      const { listener } = createTestServer();
      const ip = "10.0.0.99";

      // Default per-user limit is 20/min — send 20 requests to fill the window
      for (let i = 0; i < 20; i++) {
        const r = makeFakeReq({
          url: "/any",
          method: "GET",
          socket: { remoteAddress: ip },
        });
        const s = makeFakeRes();
        await fireRequest(listener, r, s as unknown as ServerResponse);
      }

      // 21st request should be rate limited
      const req = makeFakeReq({
        url: "/any",
        method: "GET",
        socket: { remoteAddress: ip },
      });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(429);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      const body = res.parsedBody() as { error: string; retryAfterMs: number };
      expect(body.error).toBe("Too Many Requests");
      expect(typeof body.retryAfterMs).toBe("number");
      expect(body.retryAfterMs).toBeGreaterThan(0);
    });

    it("increments http.rate_limited counter on rejection", async () => {
      const { listener } = createTestServer();
      const ip = "10.0.0.100";

      for (let i = 0; i < 20; i++) {
        const r = makeFakeReq({
          url: "/test",
          method: "GET",
          socket: { remoteAddress: ip },
        });
        const s = makeFakeRes();
        await fireRequest(listener, r, s as unknown as ServerResponse);
      }

      // Trigger rate limit
      const req = makeFakeReq({
        url: "/test",
        method: "GET",
        socket: { remoteAddress: ip },
      });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(429);
      const snap = metrics.snapshot();
      expect(snap.counters["http.rate_limited"]).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Counter instrumentation ─────────────────────────────────────────────

  describe("counter instrumentation", () => {
    it("increments http.requests for each non-metrics request", async () => {
      const { listener } = createTestServer();

      for (let i = 0; i < 3; i++) {
        const r = makeFakeReq({ url: "/some-path", method: "GET" });
        const s = makeFakeRes();
        await fireRequest(listener, r, s as unknown as ServerResponse);
      }

      const snap = metrics.snapshot();
      expect(snap.counters["http.requests"]).toBe(3);
    });

    it("does not increment http.requests for GET /metrics", async () => {
      const { listener } = createTestServer();

      const req = makeFakeReq({ url: "/metrics", method: "GET" });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      const snap = metrics.snapshot();
      expect(snap.counters["http.requests"] ?? 0).toBe(0);
    });

    it("increments http.errors when a handler throws", async () => {
      const throwingHandler = vi.fn().mockRejectedValue(new Error("kaboom"));
      const { listener } = createTestServer({
        handleHooksRequest: throwingHandler,
      });

      const req = makeFakeReq({ url: "/hooks/wake", method: "POST" });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(500);
      const snap = metrics.snapshot();
      expect(snap.counters["http.errors"]).toBe(1);
      // http.requests should also have been counted
      expect(snap.counters["http.requests"]).toBe(1);
    });
  });

  // ── Latency recording (endTimer via try/finally) ────────────────────────

  describe("latency recording", () => {
    it("records gateway latency for a normal 404 request", async () => {
      const { listener } = createTestServer();

      const req = makeFakeReq({ url: "/nonexistent", method: "GET" });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      const snap = metrics.snapshot();
      expect(snap.apiCalls["gateway"]).toBeDefined();
      expect(snap.apiCalls["gateway"].calls).toBe(1);
      expect(snap.apiCalls["gateway"].latency.count).toBe(1);
    });

    it("records gateway latency even when handler throws (try/finally)", async () => {
      const throwingHandler = vi.fn().mockRejectedValue(new Error("oops"));
      const { listener } = createTestServer({
        handleHooksRequest: throwingHandler,
      });

      const req = makeFakeReq({ url: "/hooks/test", method: "POST" });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(500);
      const snap = metrics.snapshot();
      expect(snap.apiCalls["gateway"]).toBeDefined();
      expect(snap.apiCalls["gateway"].latency.count).toBe(1);
    });

    it("records gateway latency when hooks handler succeeds", async () => {
      const successHandler = vi.fn().mockResolvedValue(true);
      const { listener } = createTestServer({
        handleHooksRequest: successHandler,
      });

      const req = makeFakeReq({ url: "/hooks/wake", method: "POST" });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      const snap = metrics.snapshot();
      expect(snap.apiCalls["gateway"]).toBeDefined();
      expect(snap.apiCalls["gateway"].latency.count).toBe(1);
    });

    it("does NOT record gateway latency for rate-limited requests", async () => {
      const { listener } = createTestServer();
      const ip = "10.0.0.200";

      // Exhaust limit
      for (let i = 0; i < 20; i++) {
        const r = makeFakeReq({
          url: "/x",
          method: "GET",
          socket: { remoteAddress: ip },
        });
        const s = makeFakeRes();
        await fireRequest(listener, r, s as unknown as ServerResponse);
      }

      metrics.reset(); // clear the 20 successful recordings

      // This 21st request is rate-limited — should NOT instrument
      const req = makeFakeReq({
        url: "/x",
        method: "GET",
        socket: { remoteAddress: ip },
      });
      const res = makeFakeRes();
      await fireRequest(listener, req, res as unknown as ServerResponse);

      expect(res.statusCode).toBe(429);
      const snap = metrics.snapshot();
      // No gateway latency should have been recorded after the reset
      expect(snap.apiCalls["gateway"]?.latency.count ?? 0).toBe(0);
    });
  });
});
