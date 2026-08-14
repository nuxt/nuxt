import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { join, resolve } from 'pathe'
import ts from 'typescript'

// `templates.ts` re-imports `./app.ts`, which reads `defaultTemplates.*` at
// module init. Pulling `app.ts` in first lets that cycle resolve the same way
// it does in production; otherwise the test would see partially-initialised
// exports and crash before any assertions run.
import '../src/core/app.ts'
import { appConfigDeclarationTemplate, appConfigTemplate, publicPathTemplate, sharedAppConfigDeclarationTemplate } from '../src/core/templates.ts'

import type { Nuxt, NuxtApp } from 'nuxt/schema'

function makeNuxt (overrides: Partial<Nuxt['options']> = {}): Nuxt {
  return {
    options: {
      dev: false,
      appConfig: {},
      app: { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' },
      ...overrides,
    },
  } as unknown as Nuxt
}

function makeApp (configs: string[] = []): NuxtApp {
  return { configs } as unknown as NuxtApp
}

describe('appConfigTemplate', () => {
  it('emits an absolute path for the `defu` import so Nitro can resolve it under strict pnpm hoist', async () => {
    const contents = await appConfigTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/from ['"]defu['"]/)
    const match = contents.match(/import \{ defuFn \} from ["']([^"']+)["']/)
    expect(match, 'expected resolved `defuFn` import').toBeTruthy()
    const resolved = match![1]!
    expect(resolve(resolved)).toBe(resolved)
    expect(existsSync(resolved)).toBe(true)
  })
})

describe('app config declaration templates', () => {
  it('keeps app config inference independent of declaration order', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-app-config-types-'))
    const typesDir = join(rootDir, 'types')
    const appConfigPath = join(rootDir, 'app.config.ts')
    const schemaPath = join(rootDir, 'schema.d.ts')
    const defuPath = join(rootDir, 'defu.d.ts')
    const sharedDeclarationPath = join(typesDir, 'shared-app.config.d.ts')
    const appDeclarationPath = join(typesDir, 'app.config.d.ts')
    const usePath = join(rootDir, 'use.ts')

    try {
      await mkdir(typesDir)
      await Promise.all([
        writeFile(appConfigPath, `export default { ui: { variants: { orientation: { action: 'action' } } } }`),
        writeFile(schemaPath, `
export interface AppConfig { [key: string]: unknown }
export interface AppConfigInput { [key: string]: unknown }
export interface CustomAppConfig { [key: string]: unknown }
export interface SharedAppConfig { [key: string]: unknown }
`),
        writeFile(defuPath, `export type Defu<Source, Defaults extends readonly unknown[]> = Source & Defaults[number]`),
        writeFile(usePath, `
import type { AppConfig, SharedAppConfig } from 'nuxt/schema'

const appConfigOrientation: keyof AppConfig['ui']['variants']['orientation'] = 'action'
const inlineAppConfigOrientation: keyof AppConfig['ui']['variants']['orientation'] = 'vertical'
const sharedConfigOrientation: keyof SharedAppConfig['ui']['variants']['orientation'] = 'vertical'
// @ts-expect-error user app.config values are not available in shared contexts
const unavailableSharedConfigOrientation: keyof SharedAppConfig['ui']['variants']['orientation'] = 'action'
void appConfigOrientation
void inlineAppConfigOrientation
void sharedConfigOrientation
void unavailableSharedConfigOrientation
`),
      ])

      const context = {
        nuxt: makeNuxt({
          appConfig: { ui: { variants: { orientation: { vertical: 'vertical' } } } },
          buildDir: rootDir,
        }),
        app: makeApp([appConfigPath]),
        options: {},
      }
      const sharedContents = await sharedAppConfigDeclarationTemplate.getContents!(context)
      const appContents = await appConfigDeclarationTemplate.getContents!(context)
      await Promise.all([
        writeFile(sharedDeclarationPath, sharedContents),
        writeFile(appDeclarationPath, appContents),
      ])

      const compilerOptions: ts.CompilerOptions = {
        baseUrl: rootDir,
        ignoreDeprecations: '6.0',
        module: ts.ModuleKind.Preserve,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        paths: {
          '@nuxt/schema': [schemaPath],
          'defu': [defuPath],
          'nuxt/schema': [schemaPath],
        },
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ESNext,
      }
      for (const declarationPaths of [
        [sharedDeclarationPath, appDeclarationPath],
        [appDeclarationPath, sharedDeclarationPath],
      ]) {
        const program = ts.createProgram({
          rootNames: [...declarationPaths, usePath],
          options: compilerOptions,
        })
        const diagnostics = ts.getPreEmitDiagnostics(program)

        expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([])
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})

describe('publicPathTemplate', () => {
  it('imports `useRuntimeConfig` from the bare `nitro/runtime-config` specifier in production builds', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt(), app: makeApp(), options: {} })

    expect(contents).toMatch(/import \{ useRuntimeConfig \} from ['"]nitro\/runtime-config['"]/)
  })

  it('omits the runtime-config import entirely in dev mode', async () => {
    const contents = await publicPathTemplate.getContents!({ nuxt: makeNuxt({ dev: true }), app: makeApp(), options: {} })

    expect(contents).not.toMatch(/runtime-config/)
    expect(contents).toMatch(/getAppConfig = \(\) => \(/)
  })
})
