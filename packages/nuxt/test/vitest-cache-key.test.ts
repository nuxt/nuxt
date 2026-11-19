import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { describe, expect, it, onTestFinished } from 'vitest'
import type { VitestPluginContext } from 'vitest/node'
import { loadNuxt } from '../src/index.ts'
import { createApp, generateApp } from '../src/core/app.ts'
import { vitestCacheKey } from '../src/core/utils/plugins.ts'

type CacheKeyGenerator = Parameters<VitestPluginContext['defineCacheKeyGenerator']>[0]

async function createProject (files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-vitest-cache-key-'))
  onTestFinished(() => rm(rootDir, { recursive: true, force: true }))
  const write = async (files: Record<string, string>) => {
    for (const [file, contents] of Object.entries(files)) {
      await mkdir(dirname(join(rootDir, file)), { recursive: true })
      await writeFile(join(rootDir, file), contents)
    }
  }
  await write({ 'nuxt.config.ts': 'export default {}\n', ...files })
  return { rootDir, write }
}

async function loadProject (rootDir: string) {
  const nuxt = await loadNuxt({ cwd: rootDir, overrides: { logLevel: 'silent' } })
  const app = nuxt.apps.default = createApp(nuxt)
  await generateApp(nuxt, app)
  await nuxt.callHook('build:before')
  const config = { plugins: [] as any[] }
  await nuxt.callHook('vite:extend', { config } as any)
  const generatorOf = (name: string) => {
    const generators: CacheKeyGenerator[] = []
    config.plugins.flat().find(plugin => plugin?.name === name).configureVitest({ defineCacheKeyGenerator: (generator: CacheKeyGenerator) => generators.push(generator) })
    expect(generators).toHaveLength(1)
    return generators[0]!
  }
  return {
    nuxt,
    regenerate: () => generateApp(nuxt, app),
    cacheKey: (name: string, file: string) => generatorOf(name)({ id: join(rootDir, file) } as Parameters<CacheKeyGenerator>[0]),
  }
}

async function cacheKey (rootDir: string, name: string, file: string) {
  const project = await loadProject(rootDir)
  try {
    return project.cacheKey(name, file)
  } finally {
    await project.nuxt.close()
  }
}

describe('vitest cache key', () => {
  it('should change when an auto-imported export moves to another file', async () => {
    const { rootDir, write } = await createProject({
      'app/composables/a.ts': 'export const useFoo = () => \'foo\'\nexport const useBar = () => \'bar\'\n',
      'app/composables/b.ts': 'export {}\n',
    })
    const key = await cacheKey(rootDir, 'nuxt:imports-transform', 'app/app.vue')
    expect(key).toBeTypeOf('string')

    await write({ 'app/composables/a.ts': 'export const useFoo = () => \'FOO\'\nexport const useBar = () => \'bar\'\n' })
    expect(await cacheKey(rootDir, 'nuxt:imports-transform', 'app/app.vue')).toBe(key)

    await write({
      'app/composables/a.ts': 'export const useBar = () => \'bar\'\n',
      'app/composables/b.ts': 'export const useFoo = () => \'foo\'\n',
    })
    expect(await cacheKey(rootDir, 'nuxt:imports-transform', 'app/app.vue')).not.toBe(key)
  })

  it('should not key modules that auto-imports are not injected into', async () => {
    const { rootDir } = await createProject({ 'app/composables/a.ts': 'export const useFoo = () => \'foo\'\n' })
    expect(await cacheKey(rootDir, 'nuxt:imports-transform', 'app/assets/main.css')).toBeUndefined()
  })

  it('should change when a component name resolves to another file', async () => {
    const { rootDir, write } = await createProject({
      'layers/base/nuxt.config.ts': 'export default {}\n',
      'layers/base/app/components/Widget.vue': '<template><span>base</span></template>\n',
      'app/components/Wrapper.vue': '<template><Widget /></template>\n',
    })
    const key = await cacheKey(rootDir, 'nuxt:components:vitest-cache-key', 'app/components/Wrapper.vue')
    expect(key).toBeTypeOf('string')

    await write({ 'app/components/Wrapper.vue': '<template><div><Widget /></div></template>\n' })
    expect(await cacheKey(rootDir, 'nuxt:components:vitest-cache-key', 'app/components/Wrapper.vue')).toBe(key)

    await write({ 'app/components/Widget.vue': '<template><span>app</span></template>\n' })
    expect(await cacheKey(rootDir, 'nuxt:components:vitest-cache-key', 'app/components/Wrapper.vue')).not.toBe(key)
  })

  it('should change when a composable becomes a keyed function', async () => {
    const { rootDir, write } = await createProject({ 'app/composables/data.ts': 'export const useData = (...args: unknown[]) => args\n' })
    const key = await cacheKey(rootDir, 'nuxt:compiler:keyed-functions', 'app/app.vue')
    expect(await cacheKey(rootDir, 'nuxt:compiler:keyed-functions', 'app/app.vue')).toBe(key)

    await write({ 'app/composables/data.ts': 'export const useData = createUseAsyncData({})\n' })
    expect(await cacheKey(rootDir, 'nuxt:compiler:keyed-functions', 'app/app.vue')).not.toBe(key)
  })

  it('should change when the route name of a page changes', async () => {
    const { rootDir, write } = await createProject({
      'nuxt.config.ts': 'export default { experimental: { normalizePageNames: true } }\n',
      'app/pages/users.vue': '<template><div><NuxtPage /></div></template>\n',
      'app/pages/about.vue': '<template><div>about</div></template>\n',
    })
    const users = await cacheKey(rootDir, 'nuxt:page-component-name-plugin', 'app/pages/users.vue')
    const about = await cacheKey(rootDir, 'nuxt:page-component-name-plugin', 'app/pages/about.vue')
    expect([users, about]).toEqual(['users', 'about'])

    await write({ 'app/pages/users/index.vue': '<template><div>index</div></template>\n' })
    expect(await cacheKey(rootDir, 'nuxt:page-component-name-plugin', 'app/pages/users.vue')).not.toBe(users)
    expect(await cacheKey(rootDir, 'nuxt:page-component-name-plugin', 'app/pages/about.vue')).toBe(about)
  })

  it('should change when imports and components are rescanned', async () => {
    const { rootDir, write } = await createProject({
      'app/composables/a.ts': 'export const useFoo = () => \'foo\'\n',
      'app/components/Widget.vue': '<template><span>widget</span></template>\n',
    })
    const { nuxt, regenerate, cacheKey } = await loadProject(rootDir)
    onTestFinished(() => nuxt.close())
    const importsKey = cacheKey('nuxt:imports-transform', 'app/app.vue')
    const componentsKey = cacheKey('nuxt:components:vitest-cache-key', 'app/app.vue')

    await write({
      'app/composables/b.ts': 'export const useBar = () => \'bar\'\n',
      'app/components/Other.vue': '<template><span>other</span></template>\n',
    })
    await nuxt.callHook('builder:watch', 'add', 'composables/b.ts')
    await regenerate()

    expect(cacheKey('nuxt:imports-transform', 'app/app.vue')).not.toBe(importsKey)
    expect(cacheKey('nuxt:components:vitest-cache-key', 'app/app.vue')).not.toBe(componentsKey)
  })

  it('should register the generator with vitest v4', () => {
    const generator = () => 'key'
    const registered: unknown[] = []
    const { configureVitest } = vitestCacheKey(generator) as { configureVitest: (context: unknown) => void }
    configureVitest({ experimental_defineCacheKeyGenerator: (generator: unknown) => registered.push(generator) })
    expect(registered).toEqual([generator])
  })
})
