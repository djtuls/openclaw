# ClawdBot / OpenClaw Production Deployment Plan

**Reference**: Continue from previous chat / AGENT-DEPLOYMENT-PLAN.md  
**Platforms**: Fly.io (primary) | Render | Railway

---

## Platform: Fly.io (configured)

### Prerequisites

- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Fly.io account (`fly auth login`)
- Model provider API key (Anthropic, OpenAI, etc.)
- Channel tokens (Discord, Telegram, Slack) if using those channels

### 1. Create app + volume (first-time only)

```bash
cd /path/to/Clawdbot_Tulsbot\ 2.0

# Create app (use unique name if "openclaw" is taken)
fly apps create openclaw

# Create persistent volume (1GB, region iad)
fly volumes create openclaw_data --size 1 --region iad
```

### 2. Set production secrets

**Required** (gateway auth for `--bind lan`):

```bash
fly secrets set OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
```

**Model provider** (at least one):

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
# or
fly secrets set OPENAI_API_KEY=sk-...
```

**Channels** (optional, only what you enable):

```bash
fly secrets set DISCORD_BOT_TOKEN=MTQ...
fly secrets set TELEGRAM_BOT_TOKEN=123456:ABCDEF...
fly secrets set SLACK_BOT_TOKEN=xoxb-...
fly secrets set SLACK_APP_TOKEN=xapp-...
```

**Optional tools**:

```bash
fly secrets set BRAVE_API_KEY=...
fly secrets set PERPLEXITY_API_KEY=pplx-...
```

### 3. Deploy

```bash
fly deploy
```

### 4. Post-deploy

- **Verify**: `fly status` and `fly logs`
- **Config**: SSH in and create `/data/openclaw.json` or use Control UI at `https://<app>.fly.dev/openclaw`
- **Docs**: [Fly.io deployment](https://docs.openclaw.ai/install/fly)

---

## Platform: Render

1. [Deploy to Render](https://render.com/deploy?repo=https://github.com/djtuls/ClawdBot_Tulsbot-2.0)
2. Set `SETUP_PASSWORD` when prompted
3. `OPENCLAW_GATEWAY_TOKEN` is auto-generated
4. Add model/channel keys in **Dashboard → Environment**
5. Complete setup at `https://<service>.onrender.com/setup`

---

## Platform: Railway

1. [Deploy on Railway](https://railway.com/deploy/clawdbot-railway-template)
2. Add Volume mounted at `/data`
3. Set env vars in Railway dashboard
4. Finish setup at `/setup`

---

## Production secrets checklist

| Secret | Required | Purpose |
|--------|----------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | Yes (Fly) | Gateway auth for non-loopback bind |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Yes | Model provider |
| `SETUP_PASSWORD` | Yes (Render) | Web setup wizard |
| `DISCORD_BOT_TOKEN` | If using Discord | Channel |
| `TELEGRAM_BOT_TOKEN` | If using Telegram | Channel |
| `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN` | If using Slack | Channel |

---

## Quick deploy (Fly.io)

```bash
# From repo root
fly secrets set OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
fly secrets set ANTHROPIC_API_KEY="<your-key>"
fly deploy
```
