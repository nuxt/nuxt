import { isExternalDependency, getPKG } from '../src/cjs'

describe('util: cjs', () => {
  test('isExternalDependency works', () => {
    expect(isExternalDependency('/var/nuxt/node_modules/dependency.js')).toBe(true)
    expect(isExternalDependency('/var/nuxt/dependency.js')).toBe(false)
    expect(isExternalDependency('C:\\nuxt\\node_modules\\dependency.js')).toBe(true)
    expect(isExternalDependency('C:\\nuxt\\dependency.js')).toBe(false)
  })

  test('getPKG should not throw error on non existing package', () => {
    expect(() => getPKG('this-doesnt-existsw')).not.toThrow()
  })
})
