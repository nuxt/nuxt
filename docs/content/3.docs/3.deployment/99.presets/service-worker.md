# Service worker

Explore the Service worker preset with Nitro to push the boundaries of Nuxt rendering to the edge.

::list

- Can be used for edge-side rendering
- No dependency on Node.js
- No Node.js environment and features
::

::alert{icon=IconPresets}
Back to [presets list](/docs/deployment/presets).
::

::alert{type=warning}
Deployment as service worker has some limitations since SSR code is not running in Node.js environment but pure JavaScript.
::

## Usage

You can use the [Nuxt config](/docs/directory-structure/nuxt.config) to explicitly set the preset to use:

```js [nuxt.config.js|ts]
export default {
  nitro: {
    preset: 'worker'
  }
}
```

Or directly use the `NITRO_PRESET` environment variable when running `nuxt build`:

```bash
NITRO_PRESET=worker npx nuxt build
```

## Entry point

The worker preset produces a service worker that can provide full HTML rendering within a worker context (for example [Cloudflare Workers](/docs/deployment/cloudflare)). It registers appropriate handlers for `fetch`, `install` and `activate`.

For more information you can see the [source code](https://github.com/nuxt/framework/blob/main/packages/nitro/src/runtime/entries/service-worker.ts).
