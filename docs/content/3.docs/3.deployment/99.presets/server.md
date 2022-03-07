# Node.js server

Discover the Node.js server preset with Nitro to deploy on any Node hosting.

::list

- **Default preset** if none is specified or auto-detected <br>
- Loads only the required chunks to render the request for optimal cold start timing <br>
- Useful for debugging
::

::alert{icon=IconPresets}
Back to [presets list](/docs/deployment/presets).
::

## Usage

You can use the [Nuxt config](/docs/directory-structure/nuxt.config) to explicitly set the preset to use:

```js [nuxt.config.js|ts]
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

## Entry point

When running `nuxt build` with the Node server preset, the result will be an entry point that launches a ready-to-run Node server.

```bash
node .output/server/index.mjs
```

## Example

```bash
$ node .output/server/index.mjs
Listening on http://localhost:3000
```

## Configuring defaults at runtime

This preset will respect the following runtime environment variables:

- `NUXT_PORT` or `PORT` (defaults to `3000`)
- `NUXT_HOST` or `HOST` (defaults to `'localhost'`)
- `NITRO_SSL_CERT` and `NITRO_SSL_KEY` - if both are present, this will launch the server in HTTPS mode. In the vast majority of cases this should not be used other than for testing, and the Nitro server should be run behind a reverse proxy like nginx or Cloudflare which terminates SSL.

## Server timings

You can enable the `nitro.timing` option to have the logs about the chunk loading and cold start performance.

```js [nuxt.config.js|ts]
export default {
  nitro: {
    preset: 'server',
    timing: true
  }
}
```

```bash
$ node .output/server/index.mjs
> Nitro Start (3ms)
Listening on http://localhost:3000
> Load chunks/nitro/static (0ms)
> Load chunks/app/render (1ms)
> Load chunks/app/client.manifest (0ms)
> Load chunks/index (3ms)
> Load chunks/app/server (2ms)
> Load chunks/app/vue3 (0ms)
```
