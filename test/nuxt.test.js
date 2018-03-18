import { resolve } from 'path'
import { Nuxt, Builder } from '..'

describe('nuxt', () => {
  test('Nuxt.js Class', () => {
    expect(typeof Nuxt).toBe('function')
  })

  test('Nuxt.js Instance', async () => {
    const nuxt = new Nuxt({
      dev: true,
      rootDir: resolve(__dirname, 'fixtures', 'empty')
    })
    expect(typeof nuxt).toBe('object')
    expect(nuxt.options.dev).toBe(true)
    expect(typeof nuxt._ready.then).toBe('function')
    await nuxt.ready()
    expect(nuxt.initialized).toBe(true)
  })

  test('Fail to build when no pages/ directory but is in the parent', () => {
    const nuxt = new Nuxt({
      dev: false,
      rootDir: resolve(__dirname, 'fixtures', 'empty', 'pages')
    })
    return new Builder(nuxt).build().catch(err => {
      let s = String(err)
      expect(s.includes('No `pages` directory found')).toBe(true)
      expect(s.includes('Did you mean to run `nuxt` in the parent (`../`) directory?')).toBe(true)
    })
  })

  test('Fail to build when no pages/ directory', () => {
    const nuxt = new Nuxt({
      dev: false,
      rootDir: resolve(__dirname)
    })
    return new Builder(nuxt).build().catch(err => {
      let s = String(err)
      expect(s.includes("Couldn't find a `pages` directory")).toBe(true)
      expect(s.includes('Please create one under the project root')).toBe(true)
    })
  })
})
