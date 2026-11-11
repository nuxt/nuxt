import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUnimport } from 'unimport'
import { TransformPlugin } from '../src/imports/transform.ts'

// `rolldown-inject-filter` is a Linux x64 build of https://github.com/rolldown/rolldown/pull/11290
describe.skipIf(process.platform !== 'linux' || process.arch !== 'x64')('imports:native-inject', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nuxt-native-inject-'))
    const files: Record<string, string> = {
      'utils.ts': `export function helper() { return 'helper' }\nexport default function greet() { return 'hi' }\n`,
      'stubs.ts': `export const useScriptStub = () => 'stub'\n`,
      'fetch.ts': `export const $fetch = () => 'fetch'\n`,
      'main.ts': [
        `import { other } from './other'`,
        `import { stub } from './stub'`,
        `import { load } from './load'`,
        `import dep from 'dep'`,
        `import included from 'included'`,
        'export default [helper(), greet(), other(), stub(), load(), dep(), included()]',
      ].join('\n'),
      'other.ts': `import { helper } from '#imports'\nexport const other = () => helper()\n`,
      'stub.ts': `export const stub = () => useScriptStub()\n`,
      'load.ts': `export const load = () => $fetch()\n`,
      'node_modules/dep/package.json': JSON.stringify({ name: 'dep', type: 'module', main: 'index.js' }),
      'node_modules/dep/index.js': 'export default () => typeof helper\n',
      'node_modules/included/package.json': JSON.stringify({ name: 'included', type: 'module', main: 'index.js' }),
      'node_modules/included/index.js': 'export default () => helper()\n',
    }
    for (const [file, content] of Object.entries(files)) {
      await mkdir(join(dir, file, '..'), { recursive: true })
      await writeFile(join(dir, file), content)
    }
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function build (nativeInject: boolean) {
    const { rolldown } = await import('rolldown-inject-filter')
    const ctx = createUnimport({
      injectAtEnd: true,
      parser: 'oxc',
      virtualImports: ['#imports'],
      imports: [
        { name: 'helper', from: join(dir, 'utils.ts') },
        { name: 'default', as: 'greet', from: join(dir, 'utils.ts') },
        { name: 'useScriptStub', from: '#app/composables/script-stubs' },
      ],
    })
    const transformed: string[] = []
    const bundle = await rolldown({
      cwd: dir,
      input: join(dir, 'main.ts'),
      plugins: [
        {
          name: 'aliases',
          resolveId: id => ({ '#build/fetch': join(dir, 'fetch.ts'), '#app/composables/script-stubs': join(dir, 'stubs.ts') })[id],
        },
        TransformPlugin({
          ctx: {
            injectImports: (code, id, options) => {
              if (id && !id.startsWith('\0')) {
                transformed.push(id.replace(dir + '/', ''))
              }
              return ctx.injectImports(code, id, options)
            },
            getNativeInject: () => ctx.getNativeInject(),
          },
          options: { nativeInject, transform: { include: [/[\\/]node_modules[\\/]included[\\/]/] } },
        }).vite() as any,
      ],
    })
    const { output } = await bundle.generate({ format: 'esm' })
    await bundle.close()
    const mod = await import(`data:text/javascript,${encodeURIComponent(output[0].code)}`)
    return { result: mod.default, transformed: transformed.sort() }
  }

  it('injects through Rolldown and runs the JS transform only where needed', async () => {
    const native = await build(true)
    expect(native.result).toEqual(['helper', 'hi', 'helper', 'stub', 'fetch', 'undefined', 'helper'])
    // only the files that mention `#imports`, `$fetch` or a script stub
    expect(native.transformed).toEqual(['fetch.ts', 'load.ts', 'other.ts', 'stub.ts', 'stubs.ts'])
  })

  it('gives the same result as the JS transform', async () => {
    const js = await build(false)
    expect(js.result).toEqual(['helper', 'hi', 'helper', 'stub', 'fetch', 'undefined', 'helper'])
    expect(js.transformed).toEqual(['fetch.ts', 'load.ts', 'main.ts', 'node_modules/included/index.js', 'other.ts', 'stub.ts', 'stubs.ts', 'utils.ts'])
  })
})
