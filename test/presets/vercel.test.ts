import { resolve } from 'pathe'
import { describe } from 'vitest'
import { setupTest, startServer, testNitroBehavior, importModule } from './_tests'

describe('nitro:preset:vercel', () => {
  const ctx = setupTest('vercel')
  testNitroBehavior(ctx, async () => {
    const handle = await importModule(resolve(ctx.outDir, 'functions/node/server/index.mjs'))
      .then(r => r.default || r)
    await startServer(ctx, handle)
    return async ({ url }) => {
      const data = await ctx.fetch(url)
      return {
        data
      }
    }
  })
})
