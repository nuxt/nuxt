import { describe, expect, it } from 'vitest'
import { createHooks } from 'hookable'
import type { Nuxt, NuxtHooks } from '@nuxt/schema'

import { runWithNuxtContext } from '../src/context.ts'
import { addTypeTemplate } from '../src/template.ts'

function createNuxt () {
  const hooks = createHooks<NuxtHooks>()
  return {
    hooks,
    hook: hooks.hook,
    callHook: hooks.callHook,
    options: { buildDir: '/app/.nuxt', build: { templates: [] }, vite: {} },
  } as unknown as Nuxt
}

describe('addTypeTemplate', () => {
  type Context = Parameters<typeof addTypeTemplate>[1]
  type Expected = Partial<Record<'references' | 'sharedReferences' | 'nodeReferences' | 'nitro' | 'vue', boolean>>

  it.each<[Context, Expected]>([
    [undefined, { references: true, vue: true }],
    [{ nuxt: true }, { references: true, vue: true }],
    [{ shared: true }, { sharedReferences: true, vue: true }],
    [{ node: true }, { nodeReferences: true }],
    [{ nitro: true }, { nitro: true }],
  ])('registers a type template with context %j', async (context, expected) => {
    const nuxt = createNuxt()
    const template = runWithNuxtContext(nuxt, () => addTypeTemplate({ filename: 'types/global.d.ts', getContents: () => '' }, context))

    const payload: Record<string, unknown[]> = {}
    const nitroPayload: Record<string, unknown[]> = {}
    await nuxt.callHook('prepare:types', payload as any)
    await nuxt.callHook('nitro:prepare:types', nitroPayload as any)

    const reference = [{ path: '/app/.nuxt/types/global.d.ts' }]
    expect(template).toMatchObject({ dst: reference[0]!.path, write: true })
    expect(payload.references).toEqual(expected.references ? reference : undefined)
    expect(payload.sharedReferences).toEqual(expected.sharedReferences ? reference : undefined)
    expect(payload.nodeReferences).toEqual(expected.nodeReferences ? reference : undefined)
    expect(nitroPayload.references).toEqual(expected.nitro ? reference : undefined)
    // exposes global types to the Vue compiler, for `defineProps<GlobalType>()`
    expect(nuxt.options.vite.vue?.script?.globalTypeFiles).toEqual(expected.vue ? [reference[0]!.path] : undefined)
  })

  it('rejects a template that is not a declaration file', () => {
    // @ts-expect-error a type template must be a declaration file
    expect(() => runWithNuxtContext(createNuxt(), () => addTypeTemplate({ filename: 'types.ts', getContents: () => '' }))).toThrow(expect.objectContaining({ name: 'NUXT_B8007' }))
  })
})
