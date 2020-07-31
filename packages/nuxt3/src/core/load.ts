import { EnvConfig } from 'nuxt/config/load'
import { loadNuxtConfig } from '../config'
import Nuxt from './nuxt'

const OVERRIDES = {
  dry: { dev: false, server: false },
  dev: { dev: true, _build: true },
  build: { dev: false, server: false, _build: true },
  start: { dev: false, _start: true }
}

export interface LoadOptions {
  for?: keyof typeof OVERRIDES
  ready?: boolean

  rootDir?: string
  envConfig?: EnvConfig
  configFile?: string
  configContext?: {}
  configOverrides?: {},
  createRequire?: (module: NodeJS.Module) => NodeJS.Require
}

export async function loadNuxt (loadOptions: LoadOptions | LoadOptions['for']) {
  // Normalize loadOptions
  if (typeof loadOptions === 'string') {
    loadOptions = { for: loadOptions }
  }
  const { ready = true } = loadOptions
  const _for = loadOptions.for || 'dry'

  // Get overrides
  const override = OVERRIDES[_for]

  // Unsupported purpose
  if (!override) {
    throw new Error('Unsupported for: ' + _for)
  }

  // Load Config
  const config = await loadNuxtConfig(loadOptions)

  // Apply config overrides
  Object.assign(config, override)

  // Initiate Nuxt
  const nuxt = new Nuxt(config)
  if (ready) {
    await nuxt.ready()
  }

  return nuxt
}
