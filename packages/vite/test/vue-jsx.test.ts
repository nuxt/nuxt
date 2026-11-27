import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { Options } from '@vitejs/plugin-vue-jsx'
import type { ResolvedConfig } from 'vite'
import { DecoratorsPlugin } from '../src/plugins/decorators'
import { VueJsxPlugin } from '../src/plugins/vue-jsx'

type Handler = (this: unknown, code: string, id: string, options?: { ssr?: boolean }) => Promise<{ code: string } | undefined>

function createNuxt (decorators: boolean) {
  return { options: { experimental: { decorators }, rootDir: import.meta.dirname, modulesDir: [] } } as unknown as Nuxt
}

function createTransform (nuxt: Nuxt, options?: Options) {
  const [plugin] = VueJsxPlugin(nuxt, options)
  ;(plugin!.configResolved as (config: Partial<ResolvedConfig>) => void)({ command: 'build', isProduction: true, build: { sourcemap: false } as ResolvedConfig['build'], root: '/' })
  const transform = (plugin!.transform as { handler: Handler }).handler
  return (code: string, id: string, ssr = false) => transform.call({}, code, id, { ssr })
}

async function lowerDecorators (nuxt: Nuxt, code: string, id: string) {
  const plugin = DecoratorsPlugin(nuxt)
  await (plugin.applyToEnvironment as () => Promise<boolean>)()
  return (plugin.transform as { handler: Handler }).handler.call({}, code, id)
}

const component = [
  'function something<T> () { return (_method: () => unknown) => () => \'decorated\' as T }',
  'class SomeClass { @something<string>() someMethod () { return \'initial\' } }',
  'export default defineComponent({ render: () => <div>{new SomeClass().someMethod()}</div> })',
].join('\n')

const jsxComponent = [
  'function something (_method) { return () => \'decorated\' }',
  'class SomeClass { @something someMethod () { return \'initial\' } }',
  'export default defineComponent({ render: () => <div>{new SomeClass().someMethod()}</div> })',
].join('\n')

const handler = [
  'function something (_method: () => unknown) { return () => \'decorated\' }',
  'class SomeClass { @something someMethod () { return \'initial\' } }',
  'export default eventHandler(() => (<div id={new SomeClass().someMethod()} />).props.id)',
].join('\n')

describe('VueJsxPlugin', () => {
  it.for([
    ['a `.tsx` app component', component, '/app/components/Decorated.tsx', false],
    ['a `.jsx` app component', jsxComponent, '/app/components/Decorated.jsx', false],
    ['a `.tsx` server handler', handler, '/server/api/decorated.tsx', true],
  ] as const)('compiles JSX in %s with decorators', async ([_, code, id, ssr]) => {
    const nuxt = createNuxt(true)
    const result = await createTransform(nuxt)(code, id, ssr)
    expect(result!.code).not.toContain('<div')

    const lowered = await lowerDecorators(nuxt, result!.code, id)
    expect(lowered!.code).not.toContain('@something')
  })

  it('runs user Babel plugins alongside decorators parsing', async () => {
    const userPlugin = () => ({
      visitor: {
        StringLiteral (path: { node: { value: string } }) {
          if (path.node.value === 'initial') {
            path.node.value = 'from-user-plugin'
          }
        },
      },
    })
    const options = { babelPlugins: [userPlugin] }
    const result = await createTransform(createNuxt(true), options)(component, '/app/components/Decorated.tsx')
    expect(result!.code).toContain('from-user-plugin')
    expect(options.babelPlugins).toEqual([userPlugin])
  })

  it('keeps user Babel plugins that already enable a decorators syntax', async () => {
    const legacyDecorators = () => ({
      manipulateOptions (_options: unknown, parserOpts: { plugins: string[] }) {
        parserOpts.plugins.push('decorators-legacy')
      },
    })
    const options = { babelPlugins: [legacyDecorators] }
    const result = await createTransform(createNuxt(true), options)(component, '/app/components/Decorated.tsx')
    expect(result!.code).toContain('@something()')
    expect(options.babelPlugins).toEqual([legacyDecorators])
  })

  it('does not parse decorators when `experimental.decorators` is disabled', async () => {
    await expect(createTransform(createNuxt(false))(component, '/app/components/Decorated.tsx')).rejects.toThrow('decorators')
  })
})
