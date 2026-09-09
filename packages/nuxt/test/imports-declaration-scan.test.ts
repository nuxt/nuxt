import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt } from '@nuxt/kit'
import { useServerBuild } from '@nuxt/kit/internal'
import type { Import, Unimport } from 'unimport'
import { loadNuxt } from '../src/index.ts'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./imports-declaration-fixture', import.meta.url))))

let appImports: Import[]
let serverImports: Import[]

beforeAll(async () => {
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: false,
    overrides: {
      builder: {
        bundle: () => {
          nuxt.hooks.removeAllHooks()
          return Promise.resolve()
        },
      },
    },
  })

  let ctx: Unimport
  nuxt.hook('imports:context', (_ctx) => { ctx = _ctx })

  await nuxt.ready()
  await buildNuxt(nuxt)
  appImports = await ctx!.getImports()
  serverImports = await useServerBuild(nuxt).imports?.() ?? []
  await nuxt.close()
}, 60_000)

const named = (imports: Import[], name: string) => imports.filter(i => (i.as || i.name) === name && i.from.startsWith(fixtureDir))

describe('imports: declaration files of a built module', () => {
  it('auto-imports the type-only exports a module ships', () => {
    // `types.d.ts` is where they survive the build
    for (const name of ['WidgetOptions', 'WidgetSize']) {
      const [type, ...rest] = named(appImports, name)
      expect(type, `${name} should be auto-imported`).toBeDefined()
      expect(rest).toHaveLength(0)
      expect(type!.type).toBe(true)
      expect(type!.from.endsWith('/composables/types.d.ts'), type!.from).toBe(true)
    }
  })

  it('auto-imports them in the server program too', () => {
    const [type, ...rest] = named(serverImports, 'ServerWidgetOptions')
    expect(type, 'ServerWidgetOptions should be auto-imported').toBeDefined()
    expect(rest).toHaveLength(0)
    expect(type!.type).toBe(true)
    expect(type!.from.endsWith('/server/utils/types.d.ts'), type!.from).toBe(true)
  })

  it('leaves a declaration file that only restates its runtime sibling', () => {
    // `widget.d.ts` restates everything `widget.mjs` exports, the class included
    expect(appImports.filter(i => i.from.endsWith('/composables/widget.d.ts'))).toEqual([])
    for (const name of ['Widget', 'widgetList']) {
      const found = named(appImports, name)
      expect(found.length, `${name} should be imported`).toBeGreaterThan(0)
      for (const i of found) {
        expect(i.from.endsWith('/composables/widget.mjs'), i.from).toBe(true)
      }
    }
  })

  it('applies the project\'s own ignore patterns inside a module directory', () => {
    // the fixture ignores `**/internal.d.ts`
    expect(named(appImports, 'InternalOnly')).toEqual([])
  })

  it('does not read declaration files in a layer\'s own directories', () => {
    // `app/composables/layer-types.d.ts` is not a source file, only a module ships a build
    expect(named(appImports, 'LayerOnly')).toEqual([])
  })
})
