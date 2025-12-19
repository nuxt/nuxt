import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { rollup } from 'rollup'

import { VirtualFSPlugin } from '../src/core/plugins/virtual.ts'

describe('virtual fs plugin', () => {
  it('should support loading files virtually', async () => {
    const code = await generateCode('export { foo } from "#build/foo"', {
      vfs: {
        '/.nuxt/foo': 'export const foo = "hello world"',
      },
    })
    expect(code).toMatchInlineSnapshot(`
      "const foo = "hello world";

      export { foo };"
    `)
  })

  it('should support loading virtual files by suffix', async () => {
    const code = await generateCode('export { foo } from "#build/foo"', {
      mode: 'client',
      vfs: {
        '/.nuxt/foo.server.ts': 'export const foo = "foo server file"',
        '/.nuxt/foo.client.ts': 'export const foo = "foo client file"',
      },
    })
    expect(code).toMatchInlineSnapshot(`
      "const foo = "foo client file";

      export { foo };"
    `)
  })

  it('should support loading files referenced relatively', async () => {
    const code = await generateCode('export { foo } from "#build/foo"', {
      vfs: {
        '/.nuxt/foo': 'export { foo } from "./bar"',
        '/.nuxt/bar': 'export const foo = "relative import"',
      },
    })
    expect(code).toMatchInlineSnapshot(`
      "const foo = "relative import";

      export { foo };"
    `)
  })
})

async function generateCode (input: string, options: { mode?: 'client' | 'server', vfs: Record<string, string> }) {
  const stubNuxt = {
    options: {
      extensions: ['.ts', '.js'],
      buildDir: '/.nuxt',
      alias: {
        '~': '/',
        '#build': '/.nuxt',
      },
    },
    vfs: options.vfs,
  } as unknown as Nuxt

  const bundle = await rollup({
    input: 'entry.ts',
    plugins: [
      {
        name: 'entry',
        resolveId (id) {
          if (id === 'entry.ts') {
            return id
          }
        },
        load (id) {
          if (id === 'entry.ts') {
            return input
          }
        },
      },
      VirtualFSPlugin(stubNuxt, { mode: options.mode || 'client', alias: stubNuxt.options.alias }).rollup(),
    ],
  })
  const { output: [chunk] } = await bundle.generate({})
  return chunk.code.trim()
}
