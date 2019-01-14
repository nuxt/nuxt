import { getDefaultNuxtConfig, getNuxtConfig } from '../src'

jest.mock('../src/options', () => ({
  getNuxtConfig: jest.fn().mockReturnValue('nuxt config')
}))

jest.mock('../src/config', () => ({
  getDefaultNuxtConfig: jest.fn().mockReturnValue('default nuxt config')
}))

describe('config: entry', () => {
  test('should export getDefaultNuxtConfig and getNuxtConfig', () => {
    expect(getNuxtConfig()).toEqual('nuxt config')
    expect(getDefaultNuxtConfig()).toEqual('default nuxt config')
  })
})
