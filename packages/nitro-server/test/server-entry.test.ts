import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { createNitro } from 'nitro/builder'

const fixtureDir = fileURLToPath(new URL('./fixtures', import.meta.url))

// `@nuxt/nitro-server` always resolves `serverDir` to an absolute `<rootDir>/server`
// (see `packages/nitro-server/src/index.ts`). Nitro's server-entry detection
// (nitrojs/nitro#4313) keys off `serverDir !== rootDir` to search the server
// directory in addition to the root, so these tests mirror that config shape.
async function detectServerEntry (dir: string) {
  const rootDir = resolve(fixtureDir, dir)
  const nitro = await createNitro({
    rootDir,
    serverDir: resolve(rootDir, 'server'),
    dev: false,
    logLevel: 0,
  })
  const entry = nitro.options.serverEntry
  await nitro.close?.()
  return entry && typeof entry === 'object' ? entry.handler : undefined
}

describe('nitro server entry detection', () => {
  it('detects a server entry inside the server/ directory', async () => {
    const handler = await detectServerEntry('server-dir-entry')
    expect(handler).toBeTruthy()
    expect(handler).toMatch(/server[/\\]server\.ts$/)
  })

  it('still detects a server entry at the project root', async () => {
    const handler = await detectServerEntry('root-entry')
    expect(handler).toBeTruthy()
    expect(handler).toMatch(/root-entry[/\\]server\.ts$/)
  })

  it('prefers the server/ entry over the root entry when both exist', async () => {
    const handler = await detectServerEntry('both-entries')
    expect(handler).toBeTruthy()
    expect(handler).toMatch(/both-entries[/\\]server[/\\]server\.ts$/)
  })

  it('detects no server entry when neither location has one', async () => {
    const handler = await detectServerEntry('no-entry')
    expect(handler).toBeFalsy()
  })
})
