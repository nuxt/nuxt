<!-- Drafted by an AI agent (Claude, via OpenCode). Not yet reviewed by a human. -->

# Nuxt + eve

This example runs a Nuxt app and an [eve](https://eve.dev) agent as one project, using the `eve/nuxt` module.

- `nuxt.config.ts` registers the `eve/nuxt` module.
- `agent/` holds the agent: its instructions, model config, and a `get_weather` tool.
- `app/app.vue` is a small chat UI built with the auto-imported `useEveAgent` composable.

## Setup

eve requires Node.js 24 or newer.

```bash
npm install
```

## Development

```bash
npm run dev
```

This starts `nuxt dev` along with the eve dev server, and proxies the eve routes (`/eve/v1/**`) through the Nuxt origin. The agent uses a model through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), so you need AI Gateway credentials (for example `AI_GATEWAY_API_KEY`) to chat with it. You can change the model in `agent/agent.ts`.

> [!NOTE]
> With eve 0.84.0 and earlier, the page does not hydrate in `nuxt dev` (the browser reports `does not provide an export named 'getContext'`). The fix is in [vercel/eve#5404](https://github.com/vercel/eve/pull/5404).

## Production

By default, eve rejects browser requests in production. Before deploying, add `agent/channels/eve.ts` with an auth policy that fits your app. See [Authentication](https://eve.dev/docs/guides/auth-and-route-protection).

On Vercel, the module deploys the Nuxt app and the agent as a single project. For other hosts, see the [eve Nuxt guide](https://eve.dev/docs/guides/frontend/nuxt#dev-vs-deploy-topology).

## Learn more

- [eve Nuxt guide](https://eve.dev/docs/guides/frontend/nuxt)
- [`useEveAgent` (Vue)](https://eve.dev/docs/guides/frontend/use-eve-agent-vue)
- [eve documentation](https://eve.dev/docs/getting-started)
