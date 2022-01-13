import { promises as fsp } from 'fs'
import { resolve } from 'pathe'
import { Miniflare } from 'miniflare'
import { describe } from 'vitest'

import { setupTest, testNitroBehavior } from './_tests'

// TODO: fix SyntaxError: Unexpected end of input on script executation
describe('nitro:preset:cloudflare', () => {
  const ctx = setupTest('cloudflare')
  testNitroBehavior(ctx, async () => {
    const script = await fsp.readFile(resolve(ctx.outDir, 'server/index.mjs'), 'utf-8')
    const mf = new Miniflare({ script })

    return async ({ url, headers, method, body }) => {
      const data = await mf.dispatchFetch('http://localhost' + url, {
        headers: headers || {},
        method: method || 'GET',
        redirect: null,
        body: body || null
      }).then(r => r.text())

      return { data }
    }
  })
})
