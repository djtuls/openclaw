import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import os from "node:os";
import type { createSubsystemLogger } from "../../../logging/subsystem.js";
import type { GatewayAuthResult, ResolvedGatewayAuth } from "../../auth.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "../../server-methods/types.js";
import type { GatewayWsClient } from "../ws-types.js";
import { loadConfig } from "../../../config/config.js";
import {
  deriveDeviceIdFromPublicKey,
  normalizeDevicePublicKeyBase64Url,
  verifyDeviceSignature,
} from "../../../infra/device-identity.js";
import {
  approveDevicePairing,
  ensureDeviceToken,
  getPairedDevice,
  requestDevicePairing,
  updatePairedDeviceMetadata,
  verifyDeviceToken,
} from "../../../infra/device-pairing.js";
import { updatePairedNodeMetadata } from "../../../infra/node-pairing.js";
import { recordRemoteNodeInfo, refreshRemoteNodeBins } from "../../../infra/skills-remote.js";
import { upsertPresence } from "../../../infra/system-presence.js";
import { loadVoiceWakeConfig } from "../../../infra/voicewake.js";
import { rawDataToString } from "../../../infra/ws.js";
import { isGatewayCliClient, isWebchatClient } from "../../../utils/message-channel.js";
import {
  AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN,
  AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
  type AuthRateLimiter,
} from "../../auth-rate-limit.js";
import { authorizeGatewayConnect, isLocalDirectRequest } from "../../auth.js";
import { buildDeviceAuthPayload } from "../../device-auth.js";
import { isLoopbackAddress, isTrustedProxyAddress, resolveGatewayClientIp } from "../../net.js";
import { resolveNodeCommandAllowlist } from "../../node-command-policy.js";
import { checkBrowserOrigin } from "../../origin-check.js";
import { GATEWAY_CLIENT_IDS } from "../../protocol/client-info.js";
import {
  type ConnectParams,
  ErrorCodes,
  type ErrorShape,
  errorShape,
  formatValidationErrors,
  PROTOCOL_VERSION,
  validateConnectParams,
  validateRequestFrame,
} from "../../protocol/index.js";
import { MAX_BUFFERED_BYTES, MAX_PAYLOAD_BYTES, TICK_INTERVAL_MS } from "../../server-constants.js";
import { handleGatewayRequest } from "../../server-methods.js";
import { formatError } from "../../server-utils.js";
import { formatForLog, logWs } from "../../ws-log.js";
import { truncateCloseReason } from "../close-reason.js";
import {
  buildGatewaySnapshot,
  getHealthCache,
  getHealthVersion,
  incrementPresenceVersion,
  refreshGatewayHealthSnapshot,
} from "../health-state.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

const DEVICE_SIGNATURE_SKEW_MS = 10 * 60 * 1000;

function resolveHostName(hostHeader?: string): string {
  const host = (hostHeader ?? "").trim().toLowerCase();
  if (!host) {
    return "";
  }
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end !== -1) {
      return host.slice(1, end);
    }
  }
  const [name] = host.split(":");
  return name ?? "";
}

type AuthProvidedKind = "token" | "password" | "none";

function formatGatewayAuthFailureMessage(params: {
  authMode: ResolvedGatewayAuth["mode"];
  authProvided: AuthProvidedKind;
  reason?: string;
  client?: { id?: string | null; mode?: string | null };
}): string {
  const { authMode, authProvided, reason, client } = params;
  const isCli = isGatewayCliClient(client);
  const isControlUi = client?.id === GATEWAY_CLIENT_IDS.CONTROL_UI;
  const isWebchat = isWebchatClient(client);
  const uiHint = "open the dashboard URL and paste the token in Control UI settings";
  const tokenHint = isCli
    ? "set gateway.remote.token to match gateway.auth.token"
    : isControlUi || isWebchat
      ? uiHint
      : "provide gateway auth token";
  const passwordHint = isCli
    ? "set gateway.remote.password to match gateway.auth.password"
    : isControlUi || isWebchat
      ? "enter the password in Control UI settings"
      : "provide gateway auth password";
  switch (reason) {
    case "token_missing":
      return `unauthorized: gateway token missing (${tokenHint})`;
    case "token_mismatch":
      return `unauthorized: gateway token mismatch (${tokenHint})`;
    case "token_missing_config":
      return "unauthorized: gateway token not configured on gateway (set gateway.auth.token)";
    case "password_missing":
      return `unauthorized: gateway password missing (${passwordHint})`;
    case "password_mismatch":
      return `unauthorized: gateway password mismatch (${passwordHint})`;
    case "password_missing_config":
      return "unauthorized: gateway password not configured on gateway (set gateway.auth.password)";
    case "tailscale_user_missing":
      return "unauthorized: tailscale identity missing (use Tailscale Serve auth or gateway token/password)";
    case "tailscale_proxy_missing":
      return "unauthorized: tailscale proxy headers missing (use Tailscale Serve or gateway token/password)";
    case "tailscale_whois_failed":
      return "unauthorized: tailscale identity check failed (use Tailscale Serve auth or gateway token/password)";
    case "tailscale_user_mismatch":
      return "unauthorized: tailscale identity mismatch (use Tailscale Serve auth or gateway token/password)";
    case "rate_limited":
      return "unauthorized: too many failed authentication attempts (retry later)";
    case "device_token_mismatch":
      return "unauthorized: device token mismatch (rotate/reissue device token)";
    default:
      break;
  }

  if (authMode === "token" && authProvided === "none") {
    return `unauthorized: gateway token missing (${tokenHint})`;
  }
  if (authMode === "password" && authProvided === "none") {
    return `unauthorized: gateway password missing (${passwordHint})`;
  }
  return "unauthorized";
}

export function attachGatewayWsMessageHandler(params: {
  socket: WebSocket;
  upgradeReq: IncomingMessage;
  connId: string;
  remoteAddr?: string;
  forwardedFor?: string;
  realIp?: string;
  requestHost?: string;
  requestOrigin?: string;
  requestUserAgent?: string;
  canvasHostUrl?: string;
  connectNonce: string;
  resolvedAuth: ResolvedGatewayAuth;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
  gatewayMethods: string[];
  events: string[];
  extraHandlers: GatewayRequestHandlers;
  buildRequestContext: () => GatewayRequestContext;
  send: (obj: unknown) => void;
  close: (code?: number, reason?: string) => void;
  isClosed: () => boolean;
  clearHandshakeTimer: () => void;
  getClient: () => GatewayWsClient | null;
  setClient: (next: GatewayWsClient) => void;
  setHandshakeState: (state: "pending" | "connected" | "failed") => void;
  setCloseCause: (cause: string, meta?: Record<string, unknown>) => void;
  setLastFrameMeta: (meta: { type?: string; method?: string; id?: string }) => void;
  logGateway: SubsystemLogger;
  logHealth: SubsystemLogger;
  logWsControl: SubsystemLogger;
}) {
  const {
    socket,
    upgradeReq,
    connId,
    remoteAddr,
    forwardedFor,
    realIp,
    requestHost,
    requestOrigin,
    requestUserAgent,
    canvasHostUrl,
    connectNonce,
    resolvedAuth,
    rateLimiter,
    gatewayMethods,
    events,
    extraHandlers,
    buildRequestContext,
    send,
    close,
    isClosed,
    clearHandshakeTimer,
    getClient,
    setClient,
    setHandshakeState,
    setCloseCause,
    setLastFrameMeta,
    logGateway,
    logHealth,
    logWsControl,
  } = params;

  const configSnapshot = loadConfig();
  const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
  const clientIp = resolveGatewayClientIp({ remoteAddr, forwardedFor, realIp, trustedProxies });

  // If proxy headers are present but the remote address isn't trusted, don't treat
  // the connection as local. This prevents auth bypass when running behind a reverse
  // proxy without proper configuration - the proxy's loopback connection would otherwise
  // cause all external requests to be treated as trusted local clients.
  const hasProxyHeaders = Boolean(forwardedFor || realIp);
  const remoteIsTrustedProxy = isTrustedProxyAddress(remoteAddr, trustedProxies);
  const hasUntrustedProxyHeaders = hasProxyHeaders && !remoteIsTrustedProxy;
  const hostName = resolveHostName(requestHost);
  const hostIsLocal = hostName === "localhost" || hostName === "127.0.0.1" || hostName === "::1";
  const hostIsTailscaleServe = hostName.endsWith(".ts.net");
  const hostIsLocalish = hostIsLocal || hostIsTailscaleServe;
  const isLocalClient = isLocalDirectRequest(upgradeReq, trustedProxies);
  const reportedClientIp =
    isLocalClient || hasUntrustedProxyHeaders
      ? undefined
      : clientIp && !isLoopbackAddress(clientIp)
        ? clientIp
        : undefined;

  if (hasUntrustedProxyHeaders) {
    logWsControl.warn(
      "Proxy headers detected from untrusted address. " +
        "Connection will not be treated as local. " +
        "Configure gateway.trustedProxies to restore local client detection behind your proxy.",
    );
  }
  if (!hostIsLocalish && isLoopbackAddress(remoteAddr) && !hasProxyHeaders) {
    logWsControl.warn(
      "Loopback connection with non-local Host header. " +
        "Treating it as remote. If you're behind a reverse proxy, " +
        "set gateway.trustedProxies and forward X-Forwarded-For/X-Real-IP.",
    );
  }

  const isWebchatConnect = (p: ConnectParams | null | undefined) => isWebchatClient(p?.client);

  socket.on("message", async (data) => {
    if (isClosed()) {
      return;
    }
    const text = rawDataToString(data);
    try {
      const parsed = JSON.parse(text);
      const frameType =
        parsed && typeof parsed === "object" && "type" in parsed
          ? typeof (parsed as { type?: unknown }).type === "string"
            ? String((parsed as { type?: unknown }).type)
            : undefined
          : undefined;
      const frameMethod =
        parsed && typeof parsed === "object" && "method" in parsed
          ? typeof (parsed as { method?: unknown }).method === "string"
            ? String((parsed as { method?: unknown }).method)
            : undefined
          : undefined;
      const frameId =
        parsed && typeof parsed === "object" && "id" in parsed
          ? typeof (parsed as { id?: unknown }).id === "string"
            ? String((parsed as { id?: unknown }).id)
            : undefined
          : undefined;
      if (frameType || frameMethod || frameId) {
        setLastFrameMeta({ type: frameType, method: frameMethod, id: frameId });
      }

      const client = getClient();
      if (!client) {
        // Handshake must be a normal request:
        // { type:"req", method:"connect", params: ConnectParams }.
        const isRequestFrame = validateRequestFrame(parsed);
        if (
          !isRequestFrame ||
          parsed.method !== "connect" ||
          !validateConnectParams(parsed.params)
        ) {
          const handshakeError = isRequestFrame
            ? parsed.method === "connect"
              ? `invalid connect params: ${formatValidationErrors(validateConnectParams.errors)}`
              : "invalid handshake: first request must be connect"
            : "invalid request frame";
          setHandshakeState("failed");
          setCloseCause("invalid-handshake", {
            frameType,
            frameMethod,
            frameId,
            handshakeError,
          });
          if (isRequestFrame) {
            const req = parsed;
            send({
              type: "res",
              id: req.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, handshakeError),
            });
          } else {
            logWsControl.warn(
              `invalid handshake conn=${connId} remote=${remoteAddr ?? "?"} fwd=${forwardedFor ?? "n/a"} origin=${requestOrigin ?? "n/a"} host=${requestHost ?? "n/a"} ua=${requestUserAgent ?? "n/a"}`,
            );
          }
          const closeReason = truncateCloseReason(handshakeError || "invalid handshake");
          if (isRequestFrame) {
            queueMicrotask(() => close(1008, closeReason));
          } else {
            close(1008, closeReason);
          }
          return;
        }

        const frame = parsed;
        const connectParams = frame.params as ConnectParams;
        const clientLabel = connectParams.client.displayName ?? connectParams.client.id;

        // protocol negotiation
        const { minProtocol, maxProtocol } = connectParams;
        if (maxProtocol < PROTOCOL_VERSION || minProtocol > PROTOCOL_VERSION) {
          setHandshakeState("failed");
          logWsControl.warn(
            `protocol mismatch conn=${connId} remote=${remoteAddr ?? "?"} client=${clientLabel} ${connectParams.client.mode} v${connectParams.client.version}`,
          );
          setCloseCause("protocol-mismatch", {
            minProtocol,
            maxProtocol,
            expectedProtocol: PROTOCOL_VERSION,
            client: connectParams.client.id,
            clientDisplayName: connectParams.client.displayName,
            mode: connectParams.client.mode,
            version: connectParams.client.version,
          });
          send({
            type: "res",
            id: frame.id,
            ok: false,
            error: errorShape(ErrorCodes.INVALID_REQUEST, "protocol mismatch", {
              details: { expectedProtocol: PROTOCOL_VERSION },
            }),
          });
          close(1002, "protocol mismatch");
          return;
        }

        const roleRaw = connectParams.role ?? "operator";
        const role = roleRaw === "operator" || roleRaw === "node" ? roleRaw : null;
        if (!role) {
          setHandshakeState("failed");
          setCloseCause("invalid-role", {
            role: roleRaw,
            client: connectParams.client.id,
            clientDisplayName: connectParams.client.displayName,
            mode: connectParams.client.mode,
            version: connectParams.client.version,
          });
          send({
            type: "res",
            id: frame.id,
            ok: false,
            error: errorShape(ErrorCodes.INVALID_REQUEST, "invalid role"),
          });
          close(1008, "invalid role");
          return;
        }
        // Default-deny: scopes must be explicit. Empty/missing scopes means no permissions.
        const scopes = Array.isArray(connectParams.scopes) ? connectParams.scopes : [];
        connectParams.role = role;
        connectParams.scopes = scopes;

        const isControlUi = connectParams.client.id === GATEWAY_CLIENT_IDS.CONTROL_UI;
        const isWebchat = isWebchatConnect(connectParams);
        if (isControlUi || isWebchat) {
          const originCheck = checkBrowserOrigin({
            requestHost,
            origin: requestOrigin,
            allowedOrigins: configSnapshot.gateway?.controlUi?.allowedOrigins,
          });
          if (!originCheck.ok) {
            const errorMessage =
              "origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)";
            setHandshakeState("failed");
            setCloseCause("origin-mismatch", {
              origin: requestOrigin ?? "n/a",
              host: requestHost ?? "n/a",
              reason: originCheck.reason,
              client: connectParams.client.id,
              clientDisplayName: connectParams.client.displayName,
              mode: connectParams.client.mode,
              version: connectParams.client.version,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, errorMessage),
            });
            close(1008, truncateCloseReason(errorMessage));
            return;
          }
        }

        const deviceRaw = connectParams.device;

        // Log connectParams for failing test
        const fs = require("node:fs");
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] CONNECT_PARAMS: hasDevice=${!!deviceRaw}, clientMode=${connectParams.client.mode}, clientId=${connectParams.client.id}\n`,
        );

        let devicePublicKey: string | null = null;
        const hasTokenAuth = Boolean(connectParams.auth?.token);
        const hasPasswordAuth = Boolean(connectParams.auth?.password);
        const hasSharedAuth = hasTokenAuth || hasPasswordAuth;
        const allowInsecureControlUi =
          isControlUi && configSnapshot.gateway?.controlUi?.allowInsecureAuth === true;
        const disableControlUiDeviceAuth =
          isControlUi && configSnapshot.gateway?.controlUi?.dangerouslyDisableDeviceAuth === true;
        const allowControlUiBypass = allowInsecureControlUi || disableControlUiDeviceAuth;
        const device = disableControlUiDeviceAuth ? null : deviceRaw;

        const hasDeviceTokenCandidate = Boolean(connectParams.auth?.token && device);
        let authResult: GatewayAuthResult = await authorizeGatewayConnect({
          auth: resolvedAuth,
          connectAuth: connectParams.auth,
          req: upgradeReq,
          trustedProxies,
          rateLimiter: hasDeviceTokenCandidate ? undefined : rateLimiter,
          clientIp,
          rateLimitScope: AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
        });

        if (
          hasDeviceTokenCandidate &&
          authResult.ok &&
          rateLimiter &&
          (authResult.method === "token" || authResult.method === "password")
        ) {
          const sharedRateCheck = rateLimiter.check(clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
          if (!sharedRateCheck.allowed) {
            authResult = {
              ok: false,
              reason: "rate_limited",
              rateLimited: true,
              retryAfterMs: sharedRateCheck.retryAfterMs,
            };
          } else {
            rateLimiter.reset(clientIp, AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET);
          }
        }

        let authOk = authResult.ok;
        let authMethod =
          authResult.method ?? (resolvedAuth.mode === "password" ? "password" : "token");
        const sharedAuthResult = hasSharedAuth
          ? await authorizeGatewayConnect({
              auth: { ...resolvedAuth, allowTailscale: false },
              connectAuth: connectParams.auth,
              req: upgradeReq,
              trustedProxies,
              // Shared-auth probe only; rate-limit side effects are handled in
              // the primary auth flow (or deferred for device-token candidates).
              rateLimitScope: AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET,
            })
          : null;
        const sharedAuthOk =
          sharedAuthResult?.ok === true &&
          (sharedAuthResult.method === "token" || sharedAuthResult.method === "password");
        const rejectUnauthorized = (failedAuth: GatewayAuthResult) => {
          setHandshakeState("failed");
          logWsControl.warn(
            `unauthorized conn=${connId} remote=${remoteAddr ?? "?"} client=${clientLabel} ${connectParams.client.mode} v${connectParams.client.version} reason=${failedAuth.reason ?? "unknown"}`,
          );
          const authProvided: AuthProvidedKind = connectParams.auth?.token
            ? "token"
            : connectParams.auth?.password
              ? "password"
              : "none";
          const authMessage = formatGatewayAuthFailureMessage({
            authMode: resolvedAuth.mode,
            authProvided,
            reason: failedAuth.reason,
            client: connectParams.client,
          });
          setCloseCause("unauthorized", {
            authMode: resolvedAuth.mode,
            authProvided,
            authReason: failedAuth.reason,
            allowTailscale: resolvedAuth.allowTailscale,
            client: connectParams.client.id,
            clientDisplayName: connectParams.client.displayName,
            mode: connectParams.client.mode,
            version: connectParams.client.version,
          });
          send({
            type: "res",
            id: frame.id,
            ok: false,
            error: errorShape(ErrorCodes.INVALID_REQUEST, authMessage),
          });
          close(1008, truncateCloseReason(authMessage));
        };

        // Log device status BEFORE check
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] PRE-DEVICE-CHECK: device=${!!device}, deviceRaw=${!!deviceRaw}, authOk=${authOk}, sharedAuthOk=${sharedAuthOk}\n`,
        );

        if (!device) {
          const canSkipDevice = sharedAuthOk;

          // Debug logging for device identity check
          const fs = require("node:fs");
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] DEVICE CHECK: device=${!!device}, sharedAuthOk=${sharedAuthOk}, canSkipDevice=${canSkipDevice}, authOk=${authOk}, hasSharedAuth=${hasSharedAuth}, isControlUi=${isControlUi}, allowControlUiBypass=${allowControlUiBypass}\n`,
          );

          if (isControlUi && !allowControlUiBypass) {
            const errorMessage = "control ui requires HTTPS or localhost (secure context)";
            setHandshakeState("failed");
            setCloseCause("control-ui-insecure-auth", {
              client: connectParams.client.id,
              clientDisplayName: connectParams.client.displayName,
              mode: connectParams.client.mode,
              version: connectParams.client.version,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, errorMessage),
            });
            close(1008, errorMessage);
            return;
          }

          // Allow shared-secret authenticated connections (e.g., control-ui) to skip device identity
          if (!canSkipDevice) {
            const fs = require("node:fs");
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT PATH: canSkipDevice=false, about to check authOk=${authOk} && hasSharedAuth=${hasSharedAuth}\n`,
            );

            if (!authOk && hasSharedAuth) {
              fs.appendFileSync(
                "/tmp/openclaw-auth-debug.log",
                `[${new Date().toISOString()}] REJECT: unauthorized (authOk=false, hasSharedAuth=true)\n`,
              );
              rejectUnauthorized(authResult);
              return;
            }

            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-required\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-required", {
              client: connectParams.client.id,
              clientDisplayName: connectParams.client.displayName,
              mode: connectParams.client.mode,
              version: connectParams.client.version,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.NOT_PAIRED, "device identity required"),
            });
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] SENT ERROR: ok=false, code=${ErrorCodes.NOT_PAIRED}, msg="device identity required"\n`,
            );
            close(1008, "device identity required");
            return;
          }
        }
        if (device) {
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] DEVICE VALIDATION START: deviceId=${device.id}, hasPublicKey=${!!device.publicKey}, hasSignature=${!!device.signature}, signedAt=${device.signedAt}, nonce=${device.nonce}\n`,
          );
          const derivedId = deriveDeviceIdFromPublicKey(device.publicKey);
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] DERIVE CHECK: derivedId=${derivedId}, deviceId=${device.id}, match=${derivedId === device.id}\n`,
          );
          if (!derivedId || derivedId !== device.id) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-id-mismatch (derivedId=${derivedId}, deviceId=${device.id})\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-auth-invalid", {
              reason: "device-id-mismatch",
              client: connectParams.client.id,
              deviceId: device.id,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, "device identity mismatch"),
            });
            close(1008, "device identity mismatch");
            return;
          }
          const signedAt = device.signedAt;
          const signedAtType = typeof signedAt;
          const timeDiff = typeof signedAt === "number" ? Math.abs(Date.now() - signedAt) : null;
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] TIMESTAMP CHECK: signedAtType=${signedAtType}, signedAt=${signedAt}, timeDiff=${timeDiff}, maxSkew=${DEVICE_SIGNATURE_SKEW_MS}\n`,
          );
          if (
            typeof signedAt !== "number" ||
            Math.abs(Date.now() - signedAt) > DEVICE_SIGNATURE_SKEW_MS
          ) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-signature-stale (signedAt=${signedAt}, timeDiff=${timeDiff})\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-auth-invalid", {
              reason: "device-signature-stale",
              client: connectParams.client.id,
              deviceId: device.id,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, "device signature expired"),
            });
            close(1008, "device signature expired");
            return;
          }
          const nonceRequired = !isLocalClient;
          const providedNonce = typeof device.nonce === "string" ? device.nonce.trim() : "";
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] NONCE CHECK: nonceRequired=${nonceRequired}, isLocalClient=${isLocalClient}, providedNonce=${providedNonce}, connectNonce=${connectNonce}\n`,
          );
          if (nonceRequired && !providedNonce) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-nonce-missing\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-auth-invalid", {
              reason: "device-nonce-missing",
              client: connectParams.client.id,
              deviceId: device.id,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, "device nonce required"),
            });
            close(1008, "device nonce required");
            return;
          }
          if (providedNonce && providedNonce !== connectNonce) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-nonce-mismatch (provided=${providedNonce}, expected=${connectNonce})\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-auth-invalid", {
              reason: "device-nonce-mismatch",
              client: connectParams.client.id,
              deviceId: device.id,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, "device nonce mismatch"),
            });
            close(1008, "device nonce mismatch");
            return;
          }
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] BUILDING PAYLOAD: providedNonce=${providedNonce}, version=${providedNonce ? "v2" : "v1"}\n`,
          );
          const payload = buildDeviceAuthPayload({
            deviceId: device.id,
            clientId: connectParams.client.id,
            clientMode: connectParams.client.mode,
            role,
            scopes,
            signedAtMs: signedAt,
            token: connectParams.auth?.token ?? null,
            nonce: providedNonce || undefined,
            version: providedNonce ? "v2" : "v1",
          });
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] SIGNATURE VERIFY START: version=${providedNonce ? "v2" : "v1"}, role=${role}, scopes=${JSON.stringify(scopes)}\n`,
          );
          const signatureOk = verifyDeviceSignature(device.publicKey, payload, device.signature);
          const allowLegacy = !nonceRequired && !providedNonce;
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] SIGNATURE VERIFY RESULT: signatureOk=${signatureOk}, allowLegacy=${allowLegacy}\n`,
          );
          if (!signatureOk && allowLegacy) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] TRYING LEGACY SIGNATURE (v1 without nonce)\n`,
            );
            const legacyPayload = buildDeviceAuthPayload({
              deviceId: device.id,
              clientId: connectParams.client.id,
              clientMode: connectParams.client.mode,
              role,
              scopes,
              signedAtMs: signedAt,
              token: connectParams.auth?.token ?? null,
              version: "v1",
            });
            const legacyOk = verifyDeviceSignature(
              device.publicKey,
              legacyPayload,
              device.signature,
            );
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] LEGACY SIGNATURE RESULT: legacyOk=${legacyOk}\n`,
            );
            if (legacyOk) {
              // accepted legacy loopback signature
              fs.appendFileSync(
                "/tmp/openclaw-auth-debug.log",
                `[${new Date().toISOString()}] ACCEPTED LEGACY SIGNATURE\n`,
              );
            } else {
              fs.appendFileSync(
                "/tmp/openclaw-auth-debug.log",
                `[${new Date().toISOString()}] REJECT: device-signature-invalid (both v2 and legacy v1 failed)\n`,
              );
              setHandshakeState("failed");
              setCloseCause("device-auth-invalid", {
                reason: "device-signature",
                client: connectParams.client.id,
                deviceId: device.id,
              });
              send({
                type: "res",
                id: frame.id,
                ok: false,
                error: errorShape(ErrorCodes.INVALID_REQUEST, "device signature invalid"),
              });
              close(1008, "device signature invalid");
              return;
            }
          } else if (!signatureOk) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-signature-invalid (no legacy allowed)\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-auth-invalid", {
              reason: "device-signature",
              client: connectParams.client.id,
              deviceId: device.id,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, "device signature invalid"),
            });
            close(1008, "device signature invalid");
            return;
          }
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] NORMALIZING PUBLIC KEY\n`,
          );
          devicePublicKey = normalizeDevicePublicKeyBase64Url(device.publicKey);
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] PUBLIC KEY NORMALIZED: devicePublicKey=${devicePublicKey ? "valid" : "null"}\n`,
          );
          if (!devicePublicKey) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECT: device-public-key-invalid\n`,
            );
            setHandshakeState("failed");
            setCloseCause("device-auth-invalid", {
              reason: "device-public-key",
              client: connectParams.client.id,
              deviceId: device.id,
            });
            send({
              type: "res",
              id: frame.id,
              ok: false,
              error: errorShape(ErrorCodes.INVALID_REQUEST, "device public key invalid"),
            });
            close(1008, "device public key invalid");
            return;
          }
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] DEVICE VALIDATION COMPLETE - all checks passed\n`,
          );
        }

        if (!authOk && connectParams.auth?.token && device) {
          if (rateLimiter) {
            const deviceRateCheck = rateLimiter.check(clientIp, AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN);
            if (!deviceRateCheck.allowed) {
              authResult = {
                ok: false,
                reason: "rate_limited",
                rateLimited: true,
                retryAfterMs: deviceRateCheck.retryAfterMs,
              };
            }
          }
          if (!authResult.rateLimited) {
            const tokenCheck = await verifyDeviceToken({
              deviceId: device.id,
              token: connectParams.auth.token,
              role,
              scopes,
            });
            if (tokenCheck.ok) {
              authOk = true;
              authMethod = "device-token";
              rateLimiter?.reset(clientIp, AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN);
            } else {
              authResult = { ok: false, reason: "device_token_mismatch" };
              rateLimiter?.recordFailure(clientIp, AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN);
            }
          }
        }
        if (!authOk) {
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] REJECT: authOk=false after all checks\n`,
          );
          rejectUnauthorized(authResult);
          return;
        }

        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] POST-AUTH: authOk=true, authMethod=${authMethod}\n`,
        );
        const skipPairing = allowControlUiBypass && sharedAuthOk;
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] PAIRING CHECK: device=${!!device}, devicePublicKey=${!!devicePublicKey}, skipPairing=${skipPairing}, allowControlUiBypass=${allowControlUiBypass}, sharedAuthOk=${sharedAuthOk}\n`,
        );
        if (device && devicePublicKey && !skipPairing) {
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] ENTERING PAIRING BLOCK\n`,
          );
          const requirePairing = async (reason: string, _paired?: { deviceId: string }) => {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REQUESTING PAIRING: reason=${reason}, isLocalClient=${isLocalClient}\n`,
            );
            const pairing = await requestDevicePairing({
              deviceId: device.id,
              publicKey: devicePublicKey,
              displayName: connectParams.client.displayName,
              platform: connectParams.client.platform,
              clientId: connectParams.client.id,
              clientMode: connectParams.client.mode,
              role,
              scopes,
              remoteIp: reportedClientIp,
              silent: isLocalClient,
            });
            const context = buildRequestContext();
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] PAIRING REQUESTED: silent=${pairing.request.silent}, created=${pairing.created}\n`,
            );
            if (pairing.request.silent === true) {
              fs.appendFileSync(
                "/tmp/openclaw-auth-debug.log",
                `[${new Date().toISOString()}] SILENT MODE - calling approveDevicePairing\n`,
              );
              const approved = await approveDevicePairing(pairing.request.requestId);
              fs.appendFileSync(
                "/tmp/openclaw-auth-debug.log",
                `[${new Date().toISOString()}] APPROVAL RESULT: approved=${!!approved}, deviceId=${approved?.device?.deviceId}\n`,
              );
              if (approved) {
                logGateway.info(
                  `device pairing auto-approved device=${approved.device.deviceId} role=${approved.device.role ?? "unknown"}`,
                );
                context.broadcast(
                  "device.pair.resolved",
                  {
                    requestId: pairing.request.requestId,
                    deviceId: approved.device.deviceId,
                    decision: "approved",
                    ts: Date.now(),
                  },
                  { dropIfSlow: true },
                );
              }
            } else if (pairing.created) {
              context.broadcast("device.pair.requested", pairing.request, { dropIfSlow: true });
            }
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REJECTION CHECK: silent=${pairing.request.silent}, will_reject=${pairing.request.silent !== true}\n`,
            );
            if (pairing.request.silent !== true) {
              setHandshakeState("failed");
              setCloseCause("pairing-required", {
                deviceId: device.id,
                requestId: pairing.request.requestId,
                reason,
              });
              send({
                type: "res",
                id: frame.id,
                ok: false,
                error: errorShape(ErrorCodes.NOT_PAIRED, "pairing required", {
                  details: { requestId: pairing.request.requestId },
                }),
              });
              close(1008, "pairing required");
              return false;
            }
            return true;
          };

          const paired = await getPairedDevice(device.id);
          const isPaired = paired?.publicKey === devicePublicKey;
          fs.appendFileSync(
            "/tmp/openclaw-auth-debug.log",
            `[${new Date().toISOString()}] PAIRING STATUS: paired=${!!paired}, isPaired=${isPaired}, pairedPublicKey=${paired?.publicKey?.substring(0, 20)}..., devicePublicKey=${devicePublicKey?.substring(0, 20)}...\n`,
          );
          if (!isPaired) {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] NOT PAIRED - calling requirePairing\n`,
            );
            const ok = await requirePairing("not-paired");
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] REQUIRE_PAIRING RETURNED: ok=${ok}\n`,
            );
            if (!ok) {
              fs.appendFileSync(
                "/tmp/openclaw-auth-debug.log",
                `[${new Date().toISOString()}] PAIRING FAILED - returning early\n`,
              );
              return;
            }
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] PAIRING SUCCEEDED - continuing to post-pairing flow\n`,
            );
          } else {
            fs.appendFileSync(
              "/tmp/openclaw-auth-debug.log",
              `[${new Date().toISOString()}] ALREADY_PAIRED - entering role/scope validation\n`,
            );
            const allowedRoles = new Set(
              Array.isArray(paired.roles) ? paired.roles : paired.role ? [paired.role] : [],
            );
            if (allowedRoles.size === 0) {
              const ok = await requirePairing("role-upgrade", paired);
              if (!ok) {
                return;
              }
            } else if (!allowedRoles.has(role)) {
              const ok = await requirePairing("role-upgrade", paired);
              if (!ok) {
                return;
              }
            }

            const pairedScopes = Array.isArray(paired.scopes) ? paired.scopes : [];
            if (scopes.length > 0) {
              if (pairedScopes.length === 0) {
                const ok = await requirePairing("scope-upgrade", paired);
                if (!ok) {
                  return;
                }
              } else {
                const allowedScopes = new Set(pairedScopes);
                const missingScope = scopes.find((scope) => !allowedScopes.has(scope));
                if (missingScope) {
                  const ok = await requirePairing("scope-upgrade", paired);
                  if (!ok) {
                    return;
                  }
                }
              }
            }

            await updatePairedDeviceMetadata(device.id, {
              displayName: connectParams.client.displayName,
              platform: connectParams.client.platform,
              clientId: connectParams.client.id,
              clientMode: connectParams.client.mode,
              role,
              scopes,
              remoteIp: reportedClientIp,
            });
          }
        }

        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] POST_PAIRING: calling ensureDeviceToken, device=${!!device}, deviceId=${device?.id}\n`,
        );
        const deviceToken = device
          ? await ensureDeviceToken({ deviceId: device.id, role, scopes })
          : null;
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] DEVICE_TOKEN: created=${!!deviceToken}, token=${deviceToken?.token.substring(0, 16)}...\n`,
        );

        if (role === "node") {
          const cfg = loadConfig();
          const allowlist = resolveNodeCommandAllowlist(cfg, {
            platform: connectParams.client.platform,
            deviceFamily: connectParams.client.deviceFamily,
          });
          const declared = Array.isArray(connectParams.commands) ? connectParams.commands : [];
          const filtered = declared
            .map((cmd) => cmd.trim())
            .filter((cmd) => cmd.length > 0 && allowlist.has(cmd));
          connectParams.commands = filtered;
        }

        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] PRESENCE_SETUP: starting presence tracking setup\n`,
        );
        const shouldTrackPresence = !isGatewayCliClient(connectParams.client);
        const clientId = connectParams.client.id;
        const instanceId = connectParams.client.instanceId;
        const presenceKey = shouldTrackPresence ? (device?.id ?? instanceId ?? connId) : undefined;
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] PRESENCE_SETUP: shouldTrack=${shouldTrackPresence}, presenceKey=${presenceKey}\n`,
        );

        logWs("in", "connect", {
          connId,
          client: connectParams.client.id,
          clientDisplayName: connectParams.client.displayName,
          version: connectParams.client.version,
          mode: connectParams.client.mode,
          clientId,
          platform: connectParams.client.platform,
          auth: authMethod,
        });

        if (isWebchatConnect(connectParams)) {
          logWsControl.info(
            `webchat connected conn=${connId} remote=${remoteAddr ?? "?"} client=${clientLabel} ${connectParams.client.mode} v${connectParams.client.version}`,
          );
        }

        if (presenceKey) {
          upsertPresence(presenceKey, {
            host: connectParams.client.displayName ?? connectParams.client.id ?? os.hostname(),
            ip: isLocalClient ? undefined : reportedClientIp,
            version: connectParams.client.version,
            platform: connectParams.client.platform,
            deviceFamily: connectParams.client.deviceFamily,
            modelIdentifier: connectParams.client.modelIdentifier,
            mode: connectParams.client.mode,
            deviceId: device?.id,
            roles: [role],
            scopes,
            instanceId: device?.id ?? instanceId,
            reason: "connect",
          });
          incrementPresenceVersion();
        }

        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] RESPONSE_BUILD: building hello-ok response\n`,
        );
        const snapshot = buildGatewaySnapshot();
        const cachedHealth = getHealthCache();
        if (cachedHealth) {
          snapshot.health = cachedHealth;
          snapshot.stateVersion.health = getHealthVersion();
        }
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] RESPONSE_BUILD: snapshot built, has_health=${!!cachedHealth}\n`,
        );
        const helloOk = {
          type: "hello-ok",
          protocol: PROTOCOL_VERSION,
          server: {
            version: process.env.OPENCLAW_VERSION ?? process.env.npm_package_version ?? "dev",
            commit: process.env.GIT_COMMIT,
            host: os.hostname(),
            connId,
          },
          features: { methods: gatewayMethods, events },
          snapshot,
          canvasHostUrl,
          auth: deviceToken
            ? {
                deviceToken: deviceToken.token,
                role: deviceToken.role,
                scopes: deviceToken.scopes,
                issuedAtMs: deviceToken.rotatedAtMs ?? deviceToken.createdAtMs,
              }
            : undefined,
          policy: {
            maxPayload: MAX_PAYLOAD_BYTES,
            maxBufferedBytes: MAX_BUFFERED_BYTES,
            tickIntervalMs: TICK_INTERVAL_MS,
          },
        };
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] RESPONSE_READY: hello-ok built, has_deviceToken=${!!deviceToken}, about to send\n`,
        );

        clearHandshakeTimer();
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] CONNECTION_SETUP: setting client state\n`,
        );
        const nextClient: GatewayWsClient = {
          socket,
          connect: connectParams,
          connId,
          presenceKey,
          clientIp: reportedClientIp,
        };
        setClient(nextClient);
        setHandshakeState("connected");
        if (role === "node") {
          const context = buildRequestContext();
          const nodeSession = context.nodeRegistry.register(nextClient, {
            remoteIp: reportedClientIp,
          });
          const instanceIdRaw = connectParams.client.instanceId;
          const instanceId = typeof instanceIdRaw === "string" ? instanceIdRaw.trim() : "";
          const nodeIdsForPairing = new Set<string>([nodeSession.nodeId]);
          if (instanceId) {
            nodeIdsForPairing.add(instanceId);
          }
          for (const nodeId of nodeIdsForPairing) {
            void updatePairedNodeMetadata(nodeId, {
              lastConnectedAtMs: nodeSession.connectedAtMs,
            }).catch((err) =>
              logGateway.warn(`failed to record last connect for ${nodeId}: ${formatForLog(err)}`),
            );
          }
          recordRemoteNodeInfo({
            nodeId: nodeSession.nodeId,
            displayName: nodeSession.displayName,
            platform: nodeSession.platform,
            deviceFamily: nodeSession.deviceFamily,
            commands: nodeSession.commands,
            remoteIp: nodeSession.remoteIp,
          });
          void refreshRemoteNodeBins({
            nodeId: nodeSession.nodeId,
            platform: nodeSession.platform,
            deviceFamily: nodeSession.deviceFamily,
            commands: nodeSession.commands,
            cfg: loadConfig(),
          }).catch((err) =>
            logGateway.warn(
              `remote bin probe failed for ${nodeSession.nodeId}: ${formatForLog(err)}`,
            ),
          );
          void loadVoiceWakeConfig()
            .then((cfg) => {
              context.nodeRegistry.sendEvent(nodeSession.nodeId, "voicewake.changed", {
                triggers: cfg.triggers,
              });
            })
            .catch((err) =>
              logGateway.warn(
                `voicewake snapshot failed for ${nodeSession.nodeId}: ${formatForLog(err)}`,
              ),
            );
        }

        logWs("out", "hello-ok", {
          connId,
          methods: gatewayMethods.length,
          events: events.length,
          presence: snapshot.presence.length,
          stateVersion: snapshot.stateVersion.presence,
        });

        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] SENDING_RESPONSE: about to send hello-ok with ok=true\n`,
        );
        send({ type: "res", id: frame.id, ok: true, payload: helloOk });
        fs.appendFileSync(
          "/tmp/openclaw-auth-debug.log",
          `[${new Date().toISOString()}] RESPONSE_SENT: hello-ok sent successfully\n`,
        );
        void refreshGatewayHealthSnapshot({ probe: true }).catch((err) =>
          logHealth.error(`post-connect health refresh failed: ${formatError(err)}`),
        );
        return;
      }

      // After handshake, accept only req frames
      if (!validateRequestFrame(parsed)) {
        send({
          type: "res",
          id: (parsed as { id?: unknown })?.id ?? "invalid",
          ok: false,
          error: errorShape(
            ErrorCodes.INVALID_REQUEST,
            `invalid request frame: ${formatValidationErrors(validateRequestFrame.errors)}`,
          ),
        });
        return;
      }
      const req = parsed;
      logWs("in", "req", { connId, id: req.id, method: req.method });
      const respond = (
        ok: boolean,
        payload?: unknown,
        error?: ErrorShape,
        meta?: Record<string, unknown>,
      ) => {
        send({ type: "res", id: req.id, ok, payload, error });
        logWs("out", "res", {
          connId,
          id: req.id,
          ok,
          method: req.method,
          errorCode: error?.code,
          errorMessage: error?.message,
          ...meta,
        });
      };

      void (async () => {
        await handleGatewayRequest({
          req,
          respond,
          client,
          isWebchatConnect,
          extraHandlers,
          context: buildRequestContext(),
        });
      })().catch((err) => {
        logGateway.error(`request handler failed: ${formatForLog(err)}`);
        respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, formatForLog(err)));
      });
    } catch (err) {
      logGateway.error(`parse/handle error: ${String(err)}`);
      logWs("out", "parse-error", { connId, error: formatForLog(err) });
      if (!getClient()) {
        close();
      }
    }
  });
}
