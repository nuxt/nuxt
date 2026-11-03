import { describe, expect, it } from 'vitest'
import { DevStyleSSRPlugin } from '../src/plugins/dev-style-ssr.ts'

describe('DevStyleSSRPlugin', () => {
  const plugin = DevStyleSSRPlugin({ srcDir: '/project/app', buildAssetsURL: '/_nuxt/' })
  const transform = (id: string) => (plugin.transform as (code: string, id: string) => string | undefined)('import.meta.hot', id)

  it.each([
    ['/project/app/assets/main.css', '/_nuxt/assets/main.css'],
    ['/project/app/assets/main.css', '/_nuxt/@fs/project/app/assets/main.css'],
    ['/project/node_modules/lib/lib.css', '/_nuxt/@fs/project/node_modules/lib/lib.css'],
    ['D:/project/node_modules/lib/lib.css', '/_nuxt/@fs/D:/project/node_modules/lib/lib.css'],
    ['\0/__uno.css', '/_nuxt/@id/__x00__/__uno.css'],
    ['virtual:theme.css', '/_nuxt/@id/virtual:theme.css'],
  ])('should remove the ssr link for %j at %j', (id, href) => {
    expect(transform(id)).toContain(`link[href="${href}"]`)
  })
})
