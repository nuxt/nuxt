import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { rolldown } from 'rolldown'

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

  it('should prefer virtual files with a suffix over unsuffixed ones', async () => {
    const code = await generateCode('export { foo } from "#build/foo"', {
      mode: 'client',
      vfs: {
        '/.nuxt/foo.ts': 'export const foo = "foo file"',
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

  it('should resolve relative imports between virtual files added after the plugin is created', async () => {
    const code = await generateCode('export { foo } from "virtual:nuxt:generated/foo.ts"', {
      vfs: {},
      lateVfs: {
        '/generated/foo.ts': 'export { foo } from "./bar"',
        '/generated/bar.ts': 'export const foo = "late relative import"',
      },
    })
    expect(code).toMatchInlineSnapshot(`
      "const foo = "late relative import";
      export { foo };"
    `)
  })

  it('should only look up relative imports from real files when they resolve into vfs directories', () => {
    const lookups: string[] = []
    const vfs = new Proxy<Record<string, string>>({ '/.nuxt/foo.ts': 'export const foo = 1' }, {
      has (target, key) {
        lookups.push(String(key))
        return Reflect.has(target, key)
      },
    })
    const plugin = VirtualFSPlugin(createStubNuxt(vfs), { mode: 'client' }).raw({}, { framework: 'rollup', versions: {} }) as unknown as {
      resolveId: { handler: (id: string, importer?: string) => string | undefined }
    }

    expect(plugin.resolveId.handler('../node_modules/pkg/index', '/src/main.ts')).toBeUndefined()
    expect(lookups).toEqual([])

    expect(plugin.resolveId.handler('../.nuxt/foo', '/src/main.ts')).toBe('virtual:nuxt:.nuxt%2Ffoo.ts')
  })

  it('should not treat directories sharing a name prefix with the build directory as vfs directories', () => {
    const plugin = VirtualFSPlugin(createStubNuxt({ '/.nuxt-foo/foo.ts': 'export const foo = 1' }), { mode: 'client' }).raw({}, { framework: 'rollup', versions: {} }) as unknown as {
      resolveId: { filter: { id: RegExp } }
    }

    expect(plugin.resolveId.filter.id.test('/.nuxt/foo.ts')).toBe(true)
    expect(plugin.resolveId.filter.id.test('/.nuxt-other/foo.ts')).toBe(false)
    expect(plugin.resolveId.filter.id.test('/.nuxt-foo/foo.ts')).toBe(true)
  })
})

function createStubNuxt (vfs: Record<string, string>) {
  return {
    options: {
      extensions: ['.ts', '.js'],
      rootDir: '/',
      buildDir: '/.nuxt',
      alias: {
        '~': '/',
        '#build': '/.nuxt',
      },
    },
    vfs,
  } as unknown as Nuxt
}

async function generateCode (input: string, options: { mode?: 'client' | 'server', vfs: Record<string, string>, lateVfs?: Record<string, string> }) {
  const stubNuxt = createStubNuxt(options.vfs)

  const virtualPlugin = VirtualFSPlugin(stubNuxt, { mode: options.mode || 'client', alias: stubNuxt.options.alias }).rolldown()
  Object.assign(stubNuxt.vfs, options.lateVfs)

  const bundle = await rolldown({
    input: 'entry.ts',
    experimental: {
      attachDebugInfo: 'none',
    },
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
      virtualPlugin,
    ],
  })
  const { output: [chunk] } = await bundle.generate()
  return chunk.code.trim()
}
