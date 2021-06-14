# Node.js server

 - Default preset if none is specified or auto-detected
 - Loads only the chunks required to render the request for optimal cold start timing
 - Useful for debugging

### Entrypoint

With `{ preset: 'server' }` the result will be an entrypoint that launches a ready-to-run Node server.

#### Example

```bash
node .output/server
# > Load chunks/nitro/server (10.405923ms)
# > Cold Start (26.289817ms)
# Listening on http://localhost:3000

curl http://localhost:3000
```
