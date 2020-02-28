import consola from 'consola'
import { NuxtCommand, getWebpackConfig } from '../..'
import webpackCommand from '../../src/commands/webpack'

const tests = [
  '',
  'devtool',
  'resolve alias',
  'module.rules',
  'module.rules test=.jsx',
  'module.rules loader=vue-',
  'module.rules loader=.*-loader'
]

describe('webpack', () => {
  beforeAll(() => {
    process.stdout.isTTY = false
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('getWebpackConfig()', async () => {
    const webpackConfig = await getWebpackConfig('Client')
    expect(webpackConfig.module.rules[0]).toMatchSnapshot()
  })

  test('nuxt webpack no match', async () => {
    const cmd = NuxtCommand.from(webpackCommand, ['module.rules', 'loader=foobar'])
    process.exit = jest.fn()
    await expect(cmd.run()).rejects
      .toThrow('No match in webpack config for path:module.rules query:loader=foobar. Try inspecting without query and path.')
  })

  for (const testCase of tests) {
    test('nuxt webpack ' + testCase, async () => {
      const cmd = NuxtCommand.from(webpackCommand, testCase.split(' '))
      await cmd.run()
      expect(consola.log.mock.calls[0][0]).toMatchSnapshot()
    })
  }
})
