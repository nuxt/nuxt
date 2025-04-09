import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plugin } from 'vite'
import type { Component } from '@nuxt/schema'
import { tryUseNuxt } from '@nuxt/kit'
import { LoaderPlugin } from '../src/components/plugins/loader'
import { normalizeLineEndings } from './utils'
import { join } from 'node:path'
import { distDir } from 'vitest/node'

vi.mock('@nuxt/kit', async (og) => {
  return {
    ...(await og<typeof import('@nuxt/kit')>()),
    tryUseNuxt: vi.fn(),
  }
})

// linux - windows compatibility
vi.mock('node:url', async (og) => {
  return {
    ...(await og<typeof import('node:url')>()),
    pathToFileURL: vi.fn((path: string) => ({ href: path })),
  }
})

const getComponents = () => [{
  filePath: '/root/serverComponent.server.vue',
  mode: 'server',
  pascalName: 'ServerComponent',
  island: true,
  kebabName: 'server-component',
  chunkName: 'components/server-component',
  export: 'default',
  shortPath: '',
  prefetch: false,
  preload: false,
}, {
  filePath: '/root/hello.vue',
  mode: 'server',
  pascalName: 'HelloWorld',
  island: true,
  kebabName: 'hello-world',
  chunkName: 'components/hello',
  export: 'default',
  shortPath: '',
  prefetch: false,
  preload: false,
}, {
  filePath: '/root/Counter.vue',
  mode: 'all',
  pascalName: 'Counter',
  island: false,
  kebabName: 'counter',
  chunkName: 'components/counter',
  export: 'default',
  shortPath: '',
  prefetch: false,
  preload: false,
}] as Component[]

const viteTransform = async (source: string, id: string) => {
  const vitePlugin = LoaderPlugin({
    getComponents,
    mode: 'server',
    serverComponentRuntime: join(distDir, 'components/runtime/server-component'),
    clientDelayedComponentRuntime: join(distDir, 'components/runtime/lazy-hydrated-component'),
    srcDir: '/src'
  }).raw({}, { framework: 'vite' }) as Plugin

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const result = await (vitePlugin.transform! as Function)(source, id)
  return typeof result === 'string' ? result : result?.code
}

const renderFn = `
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  const _component_Counter = _resolveComponent("Counter");
  _push(\`<div\`);
  _push(\`</div>\`);
}
`

describe.each([
  { mode: 'server' },
])(`LoaderPlugin`, ({ mode }) => {
  if (mode === 'server') {
    describe('wrap WithIslandTeleport()', () => {
      describe('vite', () => {
        describe('componentIslands === true', () => {
          beforeEach(() => {
            vi.mocked(tryUseNuxt).mockReturnValue({
              options: {
                // @ts-expect-error partial mock
                experimental: {
                  componentIslands: true,
                },
                dev: false,
                test: false,
              },
            })
          })
          it('should not wrap components with WithIslandTeleport', async () => {
            const result = await viteTransform(renderFn, '/root/serverComponent.server.vue')

            expect(normalizeLineEndings(result)).toMatchSnapshot()
            expect(result).not.toContain('withIslandTeleport(__nuxt_component_0)')
          })
        })
        describe('componentIslands.selectiveClient === true', () => {
          beforeEach(() => {
            vi.mocked(tryUseNuxt).mockReturnValue({
              options: {
                // @ts-expect-error partial mock
                experimental: {
                  componentIslands: {
                    selectiveClient: true,
                  },
                },
                dev: false,
                test: false,
              },
            })
          })

          it('should wrap components with WithIslandTeleport in island', async () => {
            const result = await viteTransform(renderFn, '/root/serverComponent.server.vue')

            expect(normalizeLineEndings(result)).toMatchSnapshot()
            expect(result).toContain('withIslandTeleport(__nuxt_component_0)')
          })

          it('should not wrap components with WithIslandTeleport if not in island', async () => {
            const result = await viteTransform(renderFn, 'hello.vue')

            expect(normalizeLineEndings(result)).toMatchSnapshot()
            expect(result).not.toContain('withIslandTeleport(__nuxt_component_0)')
          })
        })
        describe('componentIslands.selectiveClient === \'deep\'', () => {
          beforeEach(() => {
            vi.mocked(tryUseNuxt).mockReturnValue({
              options: {
                // @ts-expect-error partial mock
                experimental: {
                  componentIslands: {
                    selectiveClient: 'deep',
                  },
                },
                dev: false,
                test: false,
              },
            })
          })
          it.each([{ filename: '/root/serverComponent.server.vue' }, { filename: '/root/hello.vue' }])('should wrap components with WithIslandTeleport', async ({ filename }) => {
            const result = await viteTransform(renderFn, filename)

            expect(normalizeLineEndings(result)).toMatchSnapshot()
            expect(result).toContain('withIslandTeleport(__nuxt_component_0)')
          })
        })
      })
    })
  }
})
