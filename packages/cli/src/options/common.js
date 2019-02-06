import { defaultNuxtConfigFile } from '@nuxt/config'
import { normalizeArg } from '../utils'

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
    default: defaultNuxtConfigFile,
    description: `Path to Nuxt.js config file (default: \`${defaultNuxtConfigFile}\`)`
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
  // TODO: Change this to default: true in Nuxt 3
  'force-exit': {
    type: 'boolean',
    default: false,
    description: 'Force Nuxt.js to exit after the command has finished (this option has no effect on commands which start a server)'
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
