import path from 'path'
import defaultsDeep from 'lodash/defaultsDeep'
import { loadNuxtConfig as _loadNuxtConfig, getDefaultNuxtConfig } from '@nuxt/config'

export async function loadNuxtConfig (argv, configContext) {
  const rootDir = path.resolve(argv._[0] || '.')
  const configFile = argv['config-file']

  // Load config
  const options = await _loadNuxtConfig({
    rootDir,
    configFile,
    configContext,
    envConfig: {
      dotenv: argv.dotenv === 'false' ? false : argv.dotenv,
      env: argv.processenv ? process.env : {}
    }
  })

  if (argv.spa === true) {
    options.ssr = false
  } else if (argv.universal === true) {
    options.ssr = true
  }

  // Server options
  options.server = defaultsDeep({
    port: argv.port || undefined,
    host: argv.hostname || undefined,
    socket: argv['unix-socket'] || undefined
  }, options.server || {}, getDefaultNuxtConfig().server)

  return options
}
