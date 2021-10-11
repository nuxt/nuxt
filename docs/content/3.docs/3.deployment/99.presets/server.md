# Node.js server

:ok_hand: **Default preset** if none is specified or auto-detected <br>
:rocket: Loads only the required chunks to render the request for optimal cold start timing <br>
:bug: Useful for debugging

### Usage

You can use the [Nuxt config](/config) to explicity set the preset to use:

```ts [nuxt.config.js|ts]
export default {
  nitro: {
    preset: 'server'
  }
}
```

Or directly use the `NITRO_PRESET` environment variable when running `nuxt build`:

```bash
NITRO_PRESET=server npx nuxt build
```

### Entrypoint

When running `nuxt build` with the Node server preset, the result will be an entrypoint that launches a ready-to-run Node server.

```bash
node .output/server/index.mjs
```

### Example

```bash
$ node .output/server/index.mjs
Listening on http://localhost:3000
```

### Server timings

You can enable the `nitro.timing` option in order to have the logs about the chunk loading and cold start performance.

```ts [nuxt.config.js|ts]
export default {
  nitro: {
    preset: 'server',
    timing: true
  }
}
```

```bash
$ node .output/server/index.mjs
> Cold Start (3ms)
Listening on http://localhost:3000
> Load chunks/nitro/static (0ms)
> Load chunks/app/render (1ms)
> Load chunks/app/client.manifest (0ms)
> Load chunks/index (3ms)
> Load chunks/app/server (2ms)
> Load chunks/app/vue3 (0ms)
```
