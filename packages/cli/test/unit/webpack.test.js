import path from 'path'
import consola from 'consola'
import prettyFormat from 'pretty-format'
import { NuxtCommand, getWebpackConfig } from '../..'
import webpackCommand from '../../src/commands/webpack'

const replaceAll = (str, a, b) => str.split(a).join(b)
const nuxtDir = path.join(__dirname, '../../../..')
const maskDir = str => replaceAll(str, nuxtDir, '<nuxtDir>')

const tests = [
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
    expect(maskDir(prettyFormat(webpackConfig.module.rules[0]))).toMatchSnapshot()
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
      expect(maskDir(consola.log.mock.calls[0][0])).toMatchSnapshot()
    })
  }
})
