import { defaultNuxtConfigFile } from 'src/config'
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
    prepare (cmd, options, argv) {
      if (argv.modern !== undefined) {
        options.modern = normalizeArg(argv.modern)
      }
    }
  },
  target: {
    alias: 't',
    type: 'string',
    description: 'Build/start app for a different target, e.g. server, serverless and static',
    prepare (cmd, options, argv) {
      if (argv.target) {
        options.target = argv.target
      }
    }
  },
  'force-exit': {
    type: 'boolean',
    default (cmd) {
      return ['build', 'generate', 'export'].includes(cmd.name)
    },
    description: 'Whether Nuxt.js should force exit after the command has finished'
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
  },
  processenv: {
    type: 'boolean',
    default: true,
    description: 'Disable reading from `process.env` and updating it with dotenv'
  },
  dotenv: {
    type: 'string',
    default: '.env',
    description: 'Specify path to dotenv file (default: `.env`). Use `false` to disable'
  }
}
