import { resolve } from 'pathe'
import { startServer, setupTest, testNitroBehavior, importModule } from './_tests.mjs'

describe('nitro:preset:node', () => {
  const ctx = setupTest('node')
  testNitroBehavior(ctx, async () => {
    const { handle } = await importModule(resolve(ctx.outDir, 'server/index.mjs'))
    await startServer(ctx, handle)
    return async ({ url }) => {
      const data = await ctx.fetch(url)
      return {
        data
      }
    }
  })
})
