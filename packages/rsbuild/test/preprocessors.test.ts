import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { ensureDependencyInstalled } from '@nuxt/kit'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolvePreprocessorPlugins } from '../src/plugins/optional.ts'

vi.mock('@nuxt/kit', async original => ({
  ...await original<typeof import('@nuxt/kit')>(),
  ensureDependencyInstalled: vi.fn(() => Promise.resolve(false)),
  getAddDependencyCommand: (name: string) => Promise.resolve(`pnpm add -D ${name}`),
}))

type TransformDescriptor = Parameters<RsbuildPluginAPI['transform']>[0]
type TransformHandler = (context: { code: string, resourcePath: string, resourceQuery: string }) => Promise<string>

async function createTransform (options: { dev?: boolean, rootDir?: string } = {}) {
  const callHook = vi.fn()
  const rootDir = options.rootDir ?? '/project'
  const nuxt = { options: { rootDir, modulesDir: [`${rootDir}/node_modules`], dev: !!options.dev }, callHook } as unknown as Nuxt
  const transforms: Array<{ descriptor: TransformDescriptor, handler: TransformHandler }> = []
  for (const plugin of await resolvePreprocessorPlugins(nuxt)) {
    await plugin.setup({ transform: (descriptor: TransformDescriptor, handler: TransformHandler) => transforms.push({ descriptor, handler }) } as unknown as RsbuildPluginAPI)
  }

  const transform = async (id: string) => {
    const [resourcePath = '', query] = id.split('?')
    const resourceQuery = query ? `?${query}` : ''
    for (const { descriptor, handler } of transforms) {
      if ((descriptor.test as RegExp).test(resourcePath) && (!descriptor.resourceQuery || (descriptor.resourceQuery as RegExp).test(resourceQuery))) {
        await handler({ code: '', resourcePath, resourceQuery })
      }
    }
  }
  return { transform, callHook }
}

describe('resolvePreprocessorPlugins', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(ensureDependencyInstalled).mockRestore()
  })

  it('fails compilation once for each missing preprocessor plugin', async () => {
    const diagnostic = vi.spyOn(bundlerDiagnostics, 'NUXT_B7033').mockImplementation(() => new Error('missing') as any)
    const { transform } = await createTransform()

    await expect(transform('/project/app/app.vue?vue&type=style&index=0&lang=scss')).rejects.toThrow('missing')
    await expect(transform('/project/app/assets/main.sass')).rejects.toThrow('missing')
    await expect(transform('/project/app/assets/main.less')).rejects.toThrow('missing')
    await expect(transform('/project/app/pages/index.vue?vue&type=template&lang=pug')).rejects.toThrow('missing')
    await transform('/project/app/pages/index.vue?vue&type=script&lang=ts')
    await transform('/project/app/assets/main.css')

    expect(vi.mocked(ensureDependencyInstalled).mock.calls.map(([name]) => name)).toEqual(['@rsbuild/plugin-sass', '@rsbuild/plugin-less', '@rsbuild/plugin-pug'])
    expect(diagnostic.mock.calls.map(([params]) => params)).toEqual([
      { file: 'app/app.vue', lang: 'scss', packageName: '@rsbuild/plugin-sass', installCommand: 'pnpm add -D @rsbuild/plugin-sass' },
      { file: 'app/assets/main.less', lang: 'less', packageName: '@rsbuild/plugin-less', installCommand: 'pnpm add -D @rsbuild/plugin-less' },
      { file: 'app/pages/index.vue', lang: 'pug', packageName: '@rsbuild/plugin-pug', installCommand: 'pnpm add -D @rsbuild/plugin-pug' },
    ])
  })

  it('reports an installed preprocessor plugin that cannot be loaded', async () => {
    const rootDir = await mkdtemp(`${tmpdir()}/nuxt-rsbuild-`)
    const packageDir = `${rootDir}/node_modules/@rsbuild/plugin-sass`
    await mkdir(packageDir, { recursive: true })
    await writeFile(`${packageDir}/package.json`, JSON.stringify({ name: '@rsbuild/plugin-sass', type: 'module', exports: './index.js' }))
    await writeFile(`${packageDir}/index.js`, `throw new Error('boom')`)
    const diagnostic = vi.spyOn(bundlerDiagnostics, 'NUXT_B7035').mockImplementation(() => new Error('broken') as any)

    try {
      await expect(createTransform({ rootDir })).rejects.toThrow('broken')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }

    expect(ensureDependencyInstalled).not.toHaveBeenCalled()
    expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({ packageName: '@rsbuild/plugin-sass', exportName: 'pluginSass', cause: expect.objectContaining({ message: 'boom' }) }))
  })

  it('restarts nuxt in development once a missing plugin is installed', async () => {
    vi.mocked(ensureDependencyInstalled).mockResolvedValue(true)
    const { transform, callHook } = await createTransform({ dev: true })

    await transform('/project/app/pages/index.vue?vue&type=template&lang=pug')
    await transform('/project/app/pages/about.vue?vue&type=template&lang=pug')

    expect(callHook).toHaveBeenCalledTimes(1)
    expect(callHook).toHaveBeenCalledWith('restart', { hard: true })
  })

  it('asks for another build once a missing plugin is installed during a build', async () => {
    vi.mocked(ensureDependencyInstalled).mockResolvedValue(true)
    const diagnostic = vi.spyOn(bundlerDiagnostics, 'NUXT_B7034').mockImplementation(() => new Error('rebuild') as any)
    const { transform, callHook } = await createTransform()

    await expect(transform('/project/app/pages/index.vue?vue&type=template&lang=pug')).rejects.toThrow('rebuild')

    expect(callHook).not.toHaveBeenCalled()
    expect(diagnostic).toHaveBeenCalledWith({ file: 'app/pages/index.vue', packageName: '@rsbuild/plugin-pug' })
  })
})
