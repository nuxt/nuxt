import util from 'util'
import consola from 'consola'
import get from 'lodash/get'
import { common } from '../options'

export default {
  name: 'webpack',
  description: 'Inspect webpack config',
  usage: 'webpack [path] [prop=value]',
  options: {
    ...common,
    name: {
      alias: 'n',
      type: 'string',
      default: 'client',
      description: 'Webpack bundle name. Can be one of: Client, Server and Modern'
    },
    depth: {
      alias: 'd',
      type: 'string',
      default: 4,
      description: 'Inspection Depth'
    },
    colors: {
      type: 'boolean',
      default: process.stdout.isTTY,
      description: 'Output with Ansi Colors'
    }
  },
  async run (cmd) {
    const { name } = cmd.argv
    const queries = [...cmd.argv._]

    const config = await cmd.getNuxtConfig({ dev: false, server: false, _build: true })
    const nuxt = await cmd.getNuxt(config)
    const builder = await cmd.getBuilder(nuxt)
    const { bundleBuilder } = builder
    const webpackConfig = bundleBuilder.getWebpackConfig(name)

    let queryError
    const match = queries.reduce((result, query) => {
      const m = advancedGet(result, query)
      if (!m) {
        queryError = query
      }
      return m || result
    }, webpackConfig)

    consola.log(formatObj(match, {
      depth: parseInt(cmd.argv.depth),
      colors: cmd.argv.colors
    }) + '\n')

    if (queryError) {
      consola.warn(`No match in webpack config for \`${queryError}\``)
    }
  }
}

function advancedGet (obj = {}, query = '') {
  let result = obj

  if (!query || !result) {
    return result
  }

  const [l, r] = query.split('=')

  if (!Array.isArray(result)) {
    return typeof result === 'object' ? get(result, l) : result
  }

  result = result.filter((i) => {
    const v = get(i, l)

    if (!v) {
      return
    }

    if (
      (v === r) ||
      (typeof v.test === 'function' && v.test(r)) ||
      (typeof v.match === 'function' && v.match(r)) ||
      (r && r.match(v))
    ) {
      return true
    }
  })

  if (result.length === 1) {
    return result[0]
  }

  return result.length ? result : undefined
}

function formatObj (obj, formatOptions) {
  if (!util.formatWithOptions) {
    return util.format(obj)
  }
  return util.formatWithOptions(formatOptions, obj)
}
