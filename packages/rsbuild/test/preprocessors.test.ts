import type { Nuxt } from '@nuxt/schema'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolvePreprocessorPlugins } from '../src/plugins/optional.ts'

vi.mock('@nuxt/kit', async original => ({
  ...await original<typeof import('@nuxt/kit')>(),
  getAddDependencyCommand: (name: string) => Promise.resolve(`pnpm add -D ${name}`),
}))

type TransformDescriptor = Parameters<RsbuildPluginAPI['transform']>[0]
type TransformHandler = (context: { code: string, resourcePath: string, resourceQuery: string }) => Promise<string>

async function createTransform () {
  const nuxt = { options: { rootDir: '/project', modulesDir: ['/project/node_modules'] } } as unknown as Nuxt
  const transforms: Array<{ descriptor: TransformDescriptor, handler: TransformHandler }> = []
  for (const plugin of await resolvePreprocessorPlugins(nuxt)) {
    await plugin.setup({ transform: (descriptor: TransformDescriptor, handler: TransformHandler) => transforms.push({ descriptor, handler }) } as unknown as RsbuildPluginAPI)
  }

  return async (id: string) => {
    const [resourcePath = '', query] = id.split('?')
    const resourceQuery = query ? `?${query}` : ''
    for (const { descriptor, handler } of transforms) {
      if ((descriptor.test as RegExp).test(resourcePath) && (!descriptor.resourceQuery || (descriptor.resourceQuery as RegExp).test(resourceQuery))) {
        await handler({ code: '', resourcePath, resourceQuery })
      }
    }
  }
}

describe('resolvePreprocessorPlugins', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('warns once about each missing preprocessor plugin', async () => {
    const warning = vi.spyOn(bundlerDiagnostics, 'NUXT_B7033').mockImplementation(() => ({}) as any)
    const transform = await createTransform()

    await transform('/project/app/app.vue?vue&type=style&index=0&lang=scss')
    await transform('/project/app/assets/main.sass')
    await transform('/project/app/assets/main.less')
    await transform('/project/app/pages/index.vue?vue&type=template&lang=pug')
    await transform('/project/app/pages/index.vue?vue&type=script&lang=ts')
    await transform('/project/app/assets/main.css')

    expect(warning.mock.calls.map(([params]) => params)).toEqual([
      { file: 'app/app.vue', lang: 'scss', packageName: '@rsbuild/plugin-sass', installCommand: 'pnpm add -D @rsbuild/plugin-sass' },
      { file: 'app/assets/main.less', lang: 'less', packageName: '@rsbuild/plugin-less', installCommand: 'pnpm add -D @rsbuild/plugin-less' },
      { file: 'app/pages/index.vue', lang: 'pug', packageName: '@rsbuild/plugin-pug', installCommand: 'pnpm add -D @rsbuild/plugin-pug' },
    ])
  })
})
