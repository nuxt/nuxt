import { Builder } from '../src'

jest.mock('../src/builder', () => jest.fn(() => 'nuxt builder'))

describe('builder: entry', () => {
  test('should export Builder', () => {
    expect(Builder()).toEqual('nuxt builder')
  })
})
