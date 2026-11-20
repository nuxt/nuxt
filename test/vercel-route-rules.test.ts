import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { glob } from 'tinyglobby'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'

import { isNitroV3, runsOnceInMatrix } from './matrix'
import { buildInProcess } from './utils'

const rootDir = fileURLToPath(new URL('./fixtures/minimal', import.meta.url))

describe.skipIf(!runsOnceInMatrix || isNitroV3)('vercel route rules', () => {
  it('names ISR functions after the route rule keys as written', async () => {
    const cacheDir = join(rootDir, 'node_modules/.cache/nuxt/vercel-route-rules')
    const outputDir = join(cacheDir, 'output')
    await buildInProcess(rootDir, {
      buildDir: join(cacheDir, 'build'),
      nitro: { preset: 'vercel', output: { dir: outputDir } },
      routeRules: {
        '/package/:name/_payload.json': { isr: 300 },
        '/package/:org/:name/_payload.json': { isr: 300 },
      },
    })

    const functionsDir = join(outputDir, 'functions')
    const prerenderConfigs = await glob('package/**/*.prerender-config.json', { cwd: functionsDir, followSymbolicLinks: false })
    expect(prerenderConfigs.sort()).toEqual([
      'package/[name]/_payload.json-isr.prerender-config.json',
      'package/[org]/[name]/_payload.json-isr.prerender-config.json',
    ])
    for (const file of prerenderConfigs) {
      expect(existsSync(join(functionsDir, file.replace('.prerender-config.json', '.func')))).toBe(true)
    }

    const config = JSON.parse(await readFile(join(outputDir, 'config.json'), 'utf-8'))
    expect(config.routes).toContainEqual(expect.objectContaining({ dest: expect.stringContaining('/package/[org]/[name]/_payload.json-isr') }))
  }, 240_000)
})
