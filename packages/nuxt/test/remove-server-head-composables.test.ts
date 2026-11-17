// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { RemoveServerHeadComposablesPlugin } from '../src/head/plugins/remove-server-head-composables.ts'

describe('RemoveServerHeadComposablesPlugin', () => {
  const plugin = RemoveServerHeadComposablesPlugin().raw({}, {} as any) as any

  async function transform (code: string, id = '/project/app.vue'): Promise<string> {
    const result = await plugin.transform.handler(code, id)
    return result?.code ?? code
  }

  it('removes standalone calls imported from #app', async () => {
    const result = await transform(`
      import { useServerHead } from '#app'
      useServerHead({ meta: [{ name: 'server-head' }] })
      console.log('kept')
    `)
    expect(result).toContain(`import { useServerHead } from '#app'`)
    expect(result).not.toContain('useServerHead({')
    expect(result).toContain(`console.log('kept')`)
  })

  it('removes calls imported from #app/composables/head', async () => {
    const result = await transform(`
      import { useServerHeadSafe } from '#app/composables/head'
      useServerHeadSafe({ meta: [] })
    `)
    expect(result).not.toContain('useServerHeadSafe(')
  })

  it('removes calls imported from nuxt/app', async () => {
    const result = await transform(`
      import { useServerSeoMeta } from 'nuxt/app'
      useServerSeoMeta({ description: 'test' })
    `)
    expect(result).not.toContain('useServerSeoMeta(')
  })

  it('removes a call that wraps a nested server head call', async () => {
    const result = await transform(`
      import { useServerHead, useServerSeoMeta } from '#app'
      useServerHead(() => {
        useServerSeoMeta({ description: 'inner' })
        return { title: 'outer' }
      })
    `)
    expect(result).not.toContain('useServerHead(')
    expect(result).not.toContain('useServerSeoMeta(')
  })

  it('preserves syntax when removing unbraced control-flow bodies', async () => {
    const result = await transform(`
      import { useServerHead } from '#app'
      if (enabled) useServerHead({ title: 'server' })
      else console.log('fallback')
      while (pending) useServerHead({ title: 'server' })
    `, '/project/control-flow.js')
    expect(result).toContain('if (enabled) ;')
    expect(result).toContain('while (pending) ;')
    expect(result).toContain(`console.log('fallback')`)
    expect(result).not.toContain('useServerHead({')
  })

  it('keeps calls whose returned entry is used', async () => {
    const result = await transform(`
      import { useServerSeoMeta } from '#app'
      const entry = useServerSeoMeta({ description: 'test' })
      entry.patch({ description: 'updated' })
    `)
    expect(result).toContain('useServerSeoMeta({')
    expect(result).toContain('entry.patch(')
  })

  it('does not remove calls imported from other sources', async () => {
    const result = await transform(`
      import { useServerHead } from '@unhead/vue'
      useServerHead({ meta: [] })
    `)
    expect(result).toContain('useServerHead({')
  })

  it('does not remove local functions of the same name', async () => {
    const result = await transform(`
      function useServerHead () {}
      useServerHead()
    `)
    expect(result).toContain('useServerHead()')
  })
})
