#!/usr/bin/env node
/**
 * Channel Health Check Script
 *
 * Verifies connectivity and operational status for all messaging channels.
 * Tests all 8 channels: telegram, whatsapp, discord, irc, googlechat, slack, signal, imessage
 *
 * Usage:
 *   pnpm tsx scripts/check-channel-health.ts [--json] [--timeout=10000]
 */

import { listChannelPlugins } from "../src/channels/plugins/index.js";
import { buildChannelAccountSnapshot } from "../src/channels/plugins/status.js";
import { formatChannelAccountLabel } from "../src/commands/channels/shared.js";
import { readConfigFileSnapshot } from "../src/config/config.js";
import { callGateway } from "../src/gateway/call.js";

type HealthStatus = "healthy" | "degraded" | "down" | "unconfigured";

interface ChannelHealth {
  channel: string;
  accountId: string;
  name?: string;
  status: HealthStatus;
  enabled: boolean;
  configured: boolean;
  linked: boolean;
  running?: boolean;
  connected?: boolean;
  probeOk?: boolean;
  issues: string[];
  recommendations: string[];
}

interface HealthReport {
  timestamp: number;
  gatewayReachable: boolean;
  channels: ChannelHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    unconfigured: number;
  };
}

async function checkGatewayHealth(timeoutMs: number): Promise<boolean> {
  try {
    await callGateway({
      method: "ping",
      params: {},
      timeoutMs,
    });
    return true;
  } catch {
    return false;
  }
}

async function buildChannelHealth(
  plugin: ReturnType<typeof listChannelPlugins>[0],
  accountId: string,
  gatewayStatus: Record<string, unknown> | null,
): Promise<ChannelHealth> {
  const cfg = (await readConfigFileSnapshot()).config;
  const snapshot = await buildChannelAccountSnapshot({
    plugin,
    cfg,
    accountId,
  });

  const issues: string[] = [];
  const recommendations: string[] = [];

  // Extract account status from gateway if available
  const gatewayAccount = gatewayStatus
    ? (
        (gatewayStatus.channelAccounts as Record<string, unknown>)?.[plugin.id] as
          | Array<Record<string, unknown>>
          | undefined
      )?.find((acc) => acc.accountId === accountId)
    : null;

  const enabled = snapshot.enabled ?? false;
  const configured = snapshot.configured ?? false;
  const linked = snapshot.linked ?? false;
  const running = typeof gatewayAccount?.running === "boolean" ? gatewayAccount.running : undefined;
  const connected =
    typeof gatewayAccount?.connected === "boolean" ? gatewayAccount.connected : undefined;
  const probeResult = gatewayAccount?.probe as { ok?: boolean } | undefined;
  const probeOk = probeResult?.ok;

  // Determine health status
  let status: HealthStatus = "healthy";

  if (!enabled) {
    status = "unconfigured";
    issues.push("Channel account is disabled");
    recommendations.push(
      `Enable account: openclaw channels update ${plugin.id} ${accountId} --enable`,
    );
  } else if (!configured) {
    status = "unconfigured";
    issues.push("Channel not configured");
    recommendations.push(`Configure credentials: openclaw channels add ${plugin.id}`);
  } else if (!linked) {
    status = "down";
    issues.push("Channel not linked");
    recommendations.push(`Link channel: openclaw channels link ${plugin.id}`);
  } else if (probeOk === false) {
    status = "down";
    issues.push("Connectivity probe failed");
    recommendations.push(`Check credentials and network: openclaw doctor --channel=${plugin.id}`);
  } else if (running === false) {
    status = "degraded";
    issues.push("Channel stopped");
    recommendations.push(`Restart gateway: openclaw gateway restart`);
  } else if (connected === false) {
    status = "degraded";
    issues.push("Channel disconnected");
    recommendations.push(
      `Check network connectivity and restart: openclaw channels restart ${plugin.id}`,
    );
  } else if (probeOk === true && running === true && connected === true) {
    status = "healthy";
  } else if (configured && linked && enabled) {
    status = "degraded";
    issues.push("Status uncertain (gateway may be unreachable)");
    recommendations.push("Ensure gateway is running: openclaw gateway status");
  }

  return {
    channel: plugin.id,
    accountId,
    name: snapshot.name,
    status,
    enabled,
    configured,
    linked,
    running,
    connected,
    probeOk,
    issues,
    recommendations,
  };
}

async function generateHealthReport(timeoutMs: number): Promise<HealthReport> {
  const gatewayReachable = await checkGatewayHealth(timeoutMs);

  let gatewayStatus: Record<string, unknown> | null = null;
  if (gatewayReachable) {
    try {
      gatewayStatus = await callGateway({
        method: "channels.status",
        params: { probe: true, timeoutMs },
        timeoutMs,
      });
    } catch {
      // Gateway unreachable during status call
    }
  }

  const plugins = listChannelPlugins();
  const cfg = (await readConfigFileSnapshot()).config;
  const channels: ChannelHealth[] = [];

  for (const plugin of plugins) {
    const accountIds = plugin.config.listAccountIds(cfg);
    if (accountIds.length === 0) {
      // No accounts configured for this channel
      channels.push({
        channel: plugin.id,
        accountId: "default",
        status: "unconfigured",
        enabled: false,
        configured: false,
        linked: false,
        issues: ["No accounts configured"],
        recommendations: [`Add account: openclaw channels add ${plugin.id}`],
      });
    } else {
      for (const accountId of accountIds) {
        const health = await buildChannelHealth(plugin, accountId, gatewayStatus);
        channels.push(health);
      }
    }
  }

  const summary = {
    total: channels.length,
    healthy: channels.filter((c) => c.status === "healthy").length,
    degraded: channels.filter((c) => c.status === "degraded").length,
    down: channels.filter((c) => c.status === "down").length,
    unconfigured: channels.filter((c) => c.status === "unconfigured").length,
  };

  return {
    timestamp: Date.now(),
    gatewayReachable,
    channels,
    summary,
  };
}

function formatHealthReport(report: HealthReport): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("              OPENCLAW CHANNEL HEALTH REPORT");
  lines.push("═══════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Timestamp: ${new Date(report.timestamp).toISOString()}`);
  lines.push(`Gateway: ${report.gatewayReachable ? "✓ Reachable" : "✗ Unreachable"}`);
  lines.push("");

  // Summary
  lines.push("───────────────────────────────────────────────────────────");
  lines.push("SUMMARY");
  lines.push("───────────────────────────────────────────────────────────");
  lines.push(`Total Channels: ${report.summary.total}`);
  lines.push(`  ✓ Healthy:      ${report.summary.healthy}`);
  lines.push(`  ⚠ Degraded:     ${report.summary.degraded}`);
  lines.push(`  ✗ Down:         ${report.summary.down}`);
  lines.push(`  ○ Unconfigured: ${report.summary.unconfigured}`);
  lines.push("");

  // Group by status
  const healthyChannels = report.channels.filter((c) => c.status === "healthy");
  const degradedChannels = report.channels.filter((c) => c.status === "degraded");
  const downChannels = report.channels.filter((c) => c.status === "down");
  const unconfiguredChannels = report.channels.filter((c) => c.status === "unconfigured");

  if (healthyChannels.length > 0) {
    lines.push("───────────────────────────────────────────────────────────");
    lines.push("✓ HEALTHY CHANNELS");
    lines.push("───────────────────────────────────────────────────────────");
    for (const channel of healthyChannels) {
      const label = formatChannelAccountLabel({
        channel: channel.channel,
        accountId: channel.accountId,
        name: channel.name,
      });
      lines.push(`  ${label}`);
    }
    lines.push("");
  }

  if (degradedChannels.length > 0) {
    lines.push("───────────────────────────────────────────────────────────");
    lines.push("⚠ DEGRADED CHANNELS");
    lines.push("───────────────────────────────────────────────────────────");
    for (const channel of degradedChannels) {
      const label = formatChannelAccountLabel({
        channel: channel.channel,
        accountId: channel.accountId,
        name: channel.name,
      });
      lines.push(`  ${label}`);
      for (const issue of channel.issues) {
        lines.push(`    Issue: ${issue}`);
      }
      for (const rec of channel.recommendations) {
        lines.push(`    → ${rec}`);
      }
      lines.push("");
    }
  }

  if (downChannels.length > 0) {
    lines.push("───────────────────────────────────────────────────────────");
    lines.push("✗ DOWN CHANNELS");
    lines.push("───────────────────────────────────────────────────────────");
    for (const channel of downChannels) {
      const label = formatChannelAccountLabel({
        channel: channel.channel,
        accountId: channel.accountId,
        name: channel.name,
      });
      lines.push(`  ${label}`);
      for (const issue of channel.issues) {
        lines.push(`    Issue: ${issue}`);
      }
      for (const rec of channel.recommendations) {
        lines.push(`    → ${rec}`);
      }
      lines.push("");
    }
  }

  if (unconfiguredChannels.length > 0) {
    lines.push("───────────────────────────────────────────────────────────");
    lines.push("○ UNCONFIGURED CHANNELS");
    lines.push("───────────────────────────────────────────────────────────");
    for (const channel of unconfiguredChannels) {
      const label = formatChannelAccountLabel({
        channel: channel.channel,
        accountId: channel.accountId,
        name: channel.name,
      });
      lines.push(`  ${label}`);
      for (const rec of channel.recommendations) {
        lines.push(`    → ${rec}`);
      }
      lines.push("");
    }
  }

  lines.push("═══════════════════════════════════════════════════════════");

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout="));
  const timeoutMs = timeoutArg ? Number(timeoutArg.split("=")[1]) : 10_000;

  try {
    const report = await generateHealthReport(timeoutMs);

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatHealthReport(report));
    }

    // Exit with error code if any channels are down
    const hasIssues = report.summary.down > 0 || report.summary.degraded > 0;
    process.exit(hasIssues ? 1 : 0);
  } catch (err) {
    console.error("Health check failed:", err);
    process.exit(2);
  }
}

void main();
