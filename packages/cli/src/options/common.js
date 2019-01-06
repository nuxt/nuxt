import { normalizeArg } from '../utils'

const defaultConfigFile = `nuxt.config${process.env.NUXT_TS === 'true' ? '.ts' : '.js'}`

export default {
  spa: {
    alias: 's',
    type: 'boolean',
    description: 'Launch in SPA mode'
  },
  universal: {
    alias: 'u',
    type: 'boolean',
    description: 'Launch in Universal mode (default)'
  },
  'config-file': {
    alias: 'c',
    type: 'string',
    default: defaultConfigFile,
    description: `Path to Nuxt.js config file (default: \`${defaultConfigFile}\`)`
  },
  modern: {
    alias: 'm',
    type: 'string',
    description: 'Build/Start app for modern browsers, e.g. server, client and false',
    prepare(cmd, options, argv) {
      if (argv.modern !== undefined) {
        options.modern = normalizeArg(argv.modern)
      }
    }
  },
  version: {
    alias: 'v',
    type: 'boolean',
    description: 'Display the Nuxt version'
  },
  help: {
    alias: 'h',
    type: 'boolean',
    description: 'Display this message'
  }
}
