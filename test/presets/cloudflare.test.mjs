import { resolve } from 'path'
import { promises as fsp } from 'fs'
import { JSDOM } from 'jsdom'

import { setupTest, testNitroBehavior } from './_tests.mjs'

// TODO: fix SyntaxError: Unexpected end of input on script executation
describe('nitro:preset:cloudflare', () => {
  const ctx = setupTest('cloudflare')
  testNitroBehavior(ctx, async () => {
    const script = await fsp.readFile(resolve(ctx.outDir, 'server/index.mjs'), 'utf-8')
    const dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <body>
          <script>
            global = window
            window.Response = class Response {
              constructor (body, { headers, status, statusText } = {}) {
                this.body = body
                this.status = status || 200
                this.headers = headers || {}
                this.statusText = statusText || ''
              }
              get ok() {
                return this.status === 200
              }
              async text() {
                return this.body
              }
              async json() {
                return JSON.parse(this.body)
              }
            }
            window.addEventListener = (method, handler) => {
              window.handleEvent = async event => {
                event.respondWith = response => {
                  event.response = response
                }
                await handler(event)
                return event.response
              }
            }
          </script>
          <script>${script}</script>
        </body>
      </html>`,
      { runScripts: 'dangerously' }
    )

    return async ({ url, headers, method, body }) => {
      const data = await dom.window.handleEvent({
        request: {
          url: 'http://localhost' + url,
          headers: headers || {},
          method: method || 'GET',
          redirect: null,
          body: body || null
        }
      }).then(r => r.text())

      return { data }
    }
  })
})
