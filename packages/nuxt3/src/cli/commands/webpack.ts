import util from 'util'
import consola from 'consola'
import get from 'lodash/get'

import type NuxtCommand from '../command'
import { common } from '../options'

export default {
  name: 'webpack',
  description: 'Inspect Nuxt webpack config',
  usage: 'webpack [query...]',
  options: {
    ...common,
    name: {
      alias: 'n',
      type: 'string',
      default: 'client',
      description: 'Webpack bundle name: server, client, modern'
    },
    depth: {
      alias: 'd',
      type: 'string',
      default: 2,
      description: 'Inspection depth'
    },
    colors: {
      type: 'boolean',
      default: process.stdout.isTTY,
      description: 'Output with ANSI colors'
    },
    dev: {
      type: 'boolean',
      default: false,
      description: 'Inspect development mode webpack config'
    }
  },
  async run (cmd: NuxtCommand) {
    const { name } = cmd.argv
    const queries = [...cmd.argv._]

    const config = await cmd.getNuxtConfig({ dev: cmd.argv.dev, server: false })
    const nuxt = await cmd.getNuxt(config)
    const builder = await cmd.getBuilder(nuxt)
    const { bundleBuilder } = builder
    const webpackConfig = bundleBuilder.getWebpackConfig(name)

    let queryError
    const match = queries.reduce((result, query) => {
      const m = advancedGet(result, query)
      if (m === undefined) {
        queryError = query
        return result
      }
      return m
    }, webpackConfig)

    const serialized = formatObj(match, {
      depth: parseInt(cmd.argv.depth),
      colors: cmd.argv.colors
    })

    consola.log(serialized + '\n')

    if (serialized.includes('[Object]' || serialized.includes('[Array'))) {
      consola.info('You can use `--depth` or add more queries to inspect `[Object]` and `[Array]` fields.')
    }

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
