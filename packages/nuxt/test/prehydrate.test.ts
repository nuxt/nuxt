import { describe, expect, it } from 'vitest'

import { PrehydrateTransformPlugin } from '../src/core/plugins/prehydrate'

describe('prehydrate', () => {
  const transformPlugin = PrehydrateTransformPlugin().raw({}, {} as any) as { transform: (code: string, id: string) => Promise<{ code: string } | null> }

  it('should extract and minify code in onPrehydrate', async () => {
    const snippet = `
onPrehydrate(() => {
  console.log('hello world')
})
    `
    const snippet2 = `
export default {
  async setup () {
    onPrehydrate(() => {
      console.log('hello world')
    })
  }
}
    `

    for (const item of [snippet, snippet2]) {
      const { code } = await transformPlugin.transform(item, 'test.ts') ?? {}
      expect(code).toContain(`onPrehydrate("(()=>{console.log(\\"hello world\\")})")`)
    }
  })

  it('should add hash if required', async () => {
    const snippet = `
onPrehydrate((attr) => {
  console.log('hello world')
})
    `

    const { code } = await transformPlugin.transform(snippet, 'test.ts') ?? {}
    expect(code?.trim()).toMatchInlineSnapshot(`"onPrehydrate("(o=>{console.log(\\"hello world\\")})", "rifMBArY0d")"`)
  })
})
