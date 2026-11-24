import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'
import { setTimeout as sleep } from 'node:timers/promises'
import { join } from 'pathe'
import { describe, expect, it, onTestFinished } from 'vitest'
import { loadNuxt } from '../src/index.ts'

setFlagsFromString('--expose-gc')
const gc = runInNewContext('gc') as () => void

async function loadAndClose (rootDir: string) {
  const nuxt = await loadNuxt({ cwd: rootDir, overrides: { logLevel: 'silent' } })
  await nuxt.close()
  return new WeakRef(nuxt)
}

describe('nuxt.close', () => {
  it('should not retain the Nuxt instance after close', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'nuxt-close-retention-'))
    onTestFinished(() => rmSync(rootDir, { recursive: true, force: true }))
    writeFileSync(join(rootDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({ telemetry: false })')

    // TODO: also assert on the first instance once nitro's global `defineNitroConfig` no longer retains it
    await loadAndClose(rootDir)
    const ref = await loadAndClose(rootDir)

    for (let i = 0; i < 10; i++) {
      await sleep(50)
      gc()
    }
    expect(ref.deref() === undefined).toBe(true)
  })
})
