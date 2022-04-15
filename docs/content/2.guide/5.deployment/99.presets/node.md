# Node.js function

Discover the Node.js function preset with Nitro to attach Nuxt as a middleware to any Node.js server.

::list

- Compatible with many Node.js servers
- Drop-in usage with express or native HTTP server
- Loads only the chunks required to render the request for optimal cold start timing
::

::alert{icon=IconPresets}
Back to [presets list](/guide/deployment/presets).
::

## Usage

You can use the [Nuxt config](/guide/directory-structure/nuxt.config) to explicitly set the preset to use:

```js [nuxt.config.js|ts]
export default {
  nitro: {
    preset: 'node'
  }
}
```

Or directly use the `NITRO_PRESET` environment variable when running `nuxt build`:

```bash
NITRO_PRESET=node npx nuxt build
```

## Entry point

When running `nuxt build` with the Node preset, the result will be an entry point exporting a function with the familiar `(req, res) => {}` signature used in [express](https://expressjs.com/), [h3](https://github.com/unjs/h3), etc.

::alert{type=warning}
It is not recommended to use this preset directly, and particularly not with a 3rd-party server.
::

## Example

### Express middleware

```js
import express from 'express'
import handler from './.output/server'

const app = express()

app.use(handler)
app.listen(3000)
```

### Node server

```js
import { createServer } from 'node:http'
import handler from './.output/server'

const server = createServer(handler)
server.listen(8080)
```
