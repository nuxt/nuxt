import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'pathe'
import { resolveModulePath } from 'exsolve'
import ts from 'typescript'
import { describe, expect, it, onTestFinished } from 'vitest'

const declaration = resolve(import.meta.dirname, '../src/runtime/compat/nitro-v2-types.ts')
const nitroTypes = resolveModulePath('nitro/types', { from: import.meta.url }).replace(/\.mjs$/, '.d.mts')
const h3Rules = resolveModulePath('h3/rules', { from: resolveModulePath('nitro/package.json', { from: import.meta.url }) }).replace(/\.mjs$/, '.d.mts')

async function check (files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'nitro-v2-types-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(dir, name), contents)))
  const program = ts.createProgram([declaration, ...Object.keys(files).map(name => join(dir, name))], {
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    paths: { 'nitro/types': [nitroTypes], 'h3/rules': [h3Rules], 'nitropack': [declaration], 'nitropack/types': [declaration] },
  })
  return ts.getPreEmitDiagnostics(program).map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

describe('nitro v2 type declarations', () => {
  it.for(['nitropack/types', 'nitro/types'] as const)('merge `nitropack/types` augmentations into the nitro v3 interfaces when an augmentation of `%s` loads first', { timeout: 60_000 }, async (first) => {
    const augmentation = `declare module 'nitropack/types' {
  interface NitroRuntimeConfig { fromModule: number }
  interface NitroRuntimeHooks { 'module:hook': (payload: number) => void }
}
export {}
`
    const nitroAugmentation = `interface Shared { fromApp: string }
declare module 'nitro/types' {
  interface NitroRuntimeConfig extends Shared {}
  interface NitroRuntimeHooks { 'app:hook': () => void }
}
export {}
`
    const usage = `import type { NitroRuntimeConfig, NitroRuntimeHooks } from 'nitro/types'
declare const config: NitroRuntimeConfig
export const fromModule: number = config.fromModule
export const fromApp: string = config.fromApp
// @ts-expect-error a number
export const fromModuleAsString: string = config.fromModule
// @ts-expect-error a string
export const fromAppAsNumber: number = config.fromApp
export const hooks: Pick<NitroRuntimeHooks, 'module:hook' | 'app:hook'> = { 'module:hook': (payload: number) => {}, 'app:hook': () => {} }
`
    const diagnostics = await check(first === 'nitropack/types'
      ? { 'module.d.ts': augmentation, 'app.d.ts': nitroAugmentation, 'usage.ts': usage }
      : { 'app.d.ts': nitroAugmentation, 'module.d.ts': augmentation, 'usage.ts': usage })
    expect(diagnostics).toEqual([])
  })

  it('apply route rule keys declared on `nitropack` and `nitropack/types` to `h3/rules`', { timeout: 60_000 }, async () => {
    const augmentation = (specifier: string) => `declare module '${specifier}' {
  interface NitroRouteConfig { security?: { rateLimiter: boolean } }
}
`
    const usage = `import type { NormalizedRouteRules, RouteRuleConfig } from 'h3/rules'
export const config: RouteRuleConfig = { security: { rateLimiter: false } }
// @ts-expect-error not a declared rule
export const typo: RouteRuleConfig = { securty: { rateLimiter: false } }
declare const rules: NormalizedRouteRules
export const rateLimiter: boolean | undefined = rules.security?.rateLimiter
`
    const diagnostics = await check({ 'module.d.ts': `${augmentation('nitropack/types')}${augmentation('nitropack')}export {}\n`, 'usage.ts': usage })
    expect(diagnostics).toEqual([])
  })
})
