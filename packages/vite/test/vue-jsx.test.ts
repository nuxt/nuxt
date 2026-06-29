import { describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { Options } from '@vitejs/plugin-vue-jsx'
import type { ResolvedConfig } from 'vite'

vi.mock('@nuxt/kit', () => ({
  ensureDependencyInstalled: vi.fn(() => true),
  logger: { warn: vi.fn() },
}))

const { VueJsxPlugin } = await import('../src/plugins/vue-jsx')

const resolvedConfig = {
  command: 'serve',
  isProduction: false,
  root: '/project',
  build: {},
} as ResolvedConfig

async function transformTsx (code: string, options?: Options) {
  const nuxt = {
    options: {
      rootDir: '/project',
      modulesDir: [],
    },
  } as unknown as Nuxt

  const plugin = VueJsxPlugin(nuxt, options)[0]
  if (!plugin) {
    throw new Error('Expected VueJsxPlugin to return a transform plugin')
  }

  const configResolved = typeof plugin.configResolved === 'function'
    ? plugin.configResolved
    : plugin.configResolved?.handler
  configResolved?.call({} as never, resolvedConfig)

  const transform = typeof plugin.transform === 'function'
    ? plugin.transform
    : plugin.transform?.handler

  const result = await transform!.call({} as never, code, '/project/app/pages/index.tsx', {
    moduleType: 'js',
    ssr: false,
  })
  return typeof result === 'string' ? result : result?.code
}

describe('VueJsxPlugin', () => {
  it('injects HMR code for TSX components defined with defineNuxtComponent', async () => {
    const code = `
export default defineNuxtComponent({
  render() {
    return <h1>TSX page</h1>
  },
})
`

    const transformed = await transformTsx(code)

    expect(transformed).toContain('__default__.__hmrId')
    expect(transformed).toContain('import.meta.hot.accept')
    expect(transformed).toContain('__VUE_HMR_RUNTIME__.reload')
  })

  it('preserves user-defined component factory names', async () => {
    const code = `
export default defineNuxtComponent({
  render() {
    return <h1>built-in</h1>
  },
})

export const CustomComponent = defineCustomComponent({
  render() {
    return <p>custom</p>
  },
})
`

    const transformed = await transformTsx(code, {
      defineComponentName: ['defineCustomComponent'],
    })

    expect(transformed).toContain('__default__.__hmrId')
    expect(transformed).toContain('CustomComponent.__hmrId')
    expect(transformed).toContain('import.meta.hot.accept')
  })
})
