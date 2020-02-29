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
    }
  },
  async run (cmd) {
    const { name } = cmd.argv
    const [path, query] = cmd._argv

    const config = await cmd.getNuxtConfig({ dev: false, server: false, _build: true })
    const nuxt = await cmd.getNuxt(config)
    const builder = await cmd.getBuilder(nuxt)
    const { bundleBuilder } = builder
    const webpackConfig = bundleBuilder.getWebpackConfig(name)
    const match = advancedGet(webpackConfig, path, query)

    if (match === undefined) {
      throw new Error(`No match in webpack config for path:${path}${query ? ` query:${query}` : ''}. Try inspecting without query and path.`)
    }

    consola.log(formatObj(match) + '\n')
  }
}

function advancedGet (obj = {}, path = '', query = '') {
  let result = obj

  if (!path) {
    return result
  }

  result = get(obj, path)

  if (!query || !result) {
    return result
  }

  const [l, r] = query.split('=')

  if (!Array.isArray(result)) {
    return typeof result === 'object' ? get(result, l) : result
  }

  result = result.filter((i) => {
    const v = get(i, l)

    if (v === r) {
      return true
    }

    if (!v) {
      return
    }

    if (typeof v.test === 'function' && v.test(r)) {
      return true
    }

    if (typeof v.match === 'function' && v.match(r)) {
      return true
    }

    if (r.match(v)) {
      return true
    }
  })

  if (result.length === 1) {
    return result[0]
  }

  return result.length ? result : undefined
}

function formatObj (obj) {
  if (!util.formatWithOptions) {
    return util.format(obj)
  }
  return util.formatWithOptions({
    colors: process.stdout.isTTY,
    depth: Infinity
  }, obj)
}
