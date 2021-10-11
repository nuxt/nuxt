# Node.js function

 - Compatible with many Node.js servers
 - Drop-in usage with express or native http server
 - Loads only the chunks required to render the request for optimal cold start timing

### Entrypoint

With `{ preset: 'node' }` the result will be an entrypoint exporting a function with the familiar `(req, res) => {}` signature used in [express](https://expressjs.com/), [h3](https://github.com/nuxt-contrib/h3), etc.

**Warning**
It is not recommended to use this preset directly, and particularly not with a 3rd-party server.

### Example

#### Express middleware

```ts
import express from 'express'
import handler from './.output/server'

const app = express()

app.use(handler)
app.listen(3000)
```

#### Node server

```ts
import { createServer } from 'http'
import handler from './.output/server'

const server = createServer(handler)
server.listen(8080)
```

