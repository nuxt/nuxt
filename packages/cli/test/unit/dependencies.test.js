import { consola } from '../utils'
import { checkDependencies } from '../../src/utils/dependencies'

jest.mock('webpack/package.json', () => ({
  version: '5.0.0'
}))

describe('cli/utils', () => {
  afterEach(() => jest.resetAllMocks())

  test('checkDependencies', () => {
    checkDependencies()
    expect(consola.error).toHaveBeenCalledWith(
      expect.stringMatching(
        /Required version of webpack \(.*\) not installed. \(5.0.0 was detected.\)/
      )
    )
    expect(consola.error).toHaveBeenCalledTimes(1)
    if (process.version.startsWith('10')) {
      expect(consola.warn).toHaveBeenCalledTimes(1)
    } else {
      expect(consola.warn).toHaveBeenCalledTimes(0)
    }
  })
})
