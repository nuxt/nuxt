import { Generator } from '../src'

jest.mock('../src/generator', () => ({
  generator: true
}))

describe('generator: entry', () => {
  test('should export Generator', () => {
    expect(Generator.generator).toEqual(true)
  })
})
