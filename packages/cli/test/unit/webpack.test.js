import path from 'path'
import util from 'util'
import consola from 'consola'
import prettyFormat from 'pretty-format'
import { NuxtCommand, getWebpackConfig } from '../../src/index'
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
  'module.rules loader=.*-loader',
  'nuxt webpack module rules test=.pug oneOf use.0=raw'
]

describe('webpack', () => {
  beforeAll(() => {
    process.stdout.isTTY = false
    util.formatWithOptions = (opts, obj) => prettyFormat(obj)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test.posix('getWebpackConfig()', async () => {
    const webpackConfig = await getWebpackConfig('Client')
    expect(maskDir(prettyFormat(webpackConfig.module.rules[0]))).toMatchSnapshot()
  })

  test.posix('nuxt webpack no match', async () => {
    const cmd = NuxtCommand.from(webpackCommand, ['module.rules', 'loader=foobar'])
    await cmd.run()
    expect(maskDir(consola.warn.mock.calls[0][0])).toBe('No match in webpack config for `loader=foobar`')
  })

  for (const testCase of tests) {
    test.posix('nuxt webpack ' + testCase, async () => {
      const cmd = NuxtCommand.from(webpackCommand, testCase.split(' '))
      await cmd.run()
      expect(maskDir(consola.log.mock.calls[0][0])).toMatchSnapshot()
    })
  }
})
