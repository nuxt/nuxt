import { consola } from '../utils'
import { checkDependencies } from '../../src/utils/dependencies'

jest.mock('webpack/package.json', () => ({
  version: '5.0.0'
}))

describe('cli/utils', () => {
  afterEach(() => jest.resetAllMocks())

  test('checkDependencies', () => {
    checkDependencies()
    expect(consola.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /webpack@.+ is installed but .+ is expected/
      )
    )
    if (process.version.startsWith('v10')) {
      expect(consola.warn).toHaveBeenCalledTimes(2)
    } else {
      expect(consola.warn).toHaveBeenCalledTimes(1)
    }
  })
})
