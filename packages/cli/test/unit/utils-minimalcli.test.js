import { consola } from '../utils'
import { showBanner } from '../../src/utils/banner'

jest.mock('std-env', () => ({
  test: false,
  minimalCLI: true
}))

describe('cli/utils', () => {
  afterEach(() => jest.resetAllMocks())

  test('showBanner prints only listeners', () => {
    const listeners = [
      { url: 'first' },
      { url: 'second' }
    ]

    showBanner({
      options: {
        cli: {
          bannerColor: 'green'
        }
      },
      server: {
        listeners
      }
    })

    expect(consola.info).toHaveBeenCalledTimes(2)
    expect(consola.info).toHaveBeenCalledWith(`Listening on: ${listeners[0].url}`)
    expect(consola.info).toHaveBeenCalledWith(`Listening on: ${listeners[1].url}`)
  })
})
