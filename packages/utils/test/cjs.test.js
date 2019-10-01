import path from 'path'
import { isExternalDependency, getPKG } from '../src/cjs'

jest.mock('path')

describe('util: context', () => {
  test('isExternalDependency works on linux', () => {
    path.sep = '/'

    expect(isExternalDependency('/var/nuxt/node_modules/dependency.js')).toBe(true)
    expect(isExternalDependency('/var/nuxt/dependency.js')).toBe(false)
  })

  test('isExternalDependency works on windows', () => {
    path.sep = '\\'

    expect(isExternalDependency('C:\\nuxt\\node_modules\\dependency.js')).toBe(true)
    expect(isExternalDependency('C:\\nuxt\\dependency.js')).toBe(false)
  })

  test('getPKG should not throw error on non existing package', () => {
    expect(() => getPKG('this-doesnt-existsw')).not.toThrow()
  })
})
