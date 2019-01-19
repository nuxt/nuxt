import { Module, Nuxt, Resolver } from '../src'

jest.mock('../src/module', () => ({
  module: true
})).mock('../src/nuxt', () => ({
  nuxt: true
})).mock('../src/resolver', () => ({
  resolver: true
}))

describe('core: entry', () => {
  test('should export Module, Nuxt and Resolver', () => {
    expect(Module.module).toEqual(true)
    expect(Nuxt.nuxt).toEqual(true)
    expect(Resolver.resolver).toEqual(true)
  })
})
