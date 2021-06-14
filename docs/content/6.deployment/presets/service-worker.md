# Service worker

 - Can be used for edge rendering
 - No dependency on Node.js
 - No Node.js environment and features

**Warning**
Deployment as service worker has some limitations since SSR code is not running in Node.js environment but pure JavaScript.

### Entrypoint

The worker preset produces a service worker that can provide full HTML rendering within a worker context (for example [Cloudflare Workers](/deploy/cloudflare)). It registers appropriate handlers for `fetch`, `install` and `activate`.

For more information you can see the [source code](https://github.com/nuxt/nitro/blob/main/src/runtime/entries/service-worker.ts).
