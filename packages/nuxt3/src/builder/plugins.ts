
import { NuxtApp } from './app'
import { Builder } from './builder'
import { resolveFiles } from './utils'

export interface NuxtPlugin {
  src: string
  mode: 'server' | 'client' | 'all'
}

const MODES_REGEX = /\.(server|client)(\.\w+)*$/
const getPluginMode = (src) => {
  const [, mode = 'all'] = src.match(MODES_REGEX) || []

  return mode
}

export function resolvePlugins (builder: Builder, app: NuxtApp) {
  return resolveFiles(builder, 'plugins/**/*.{js,ts}', app.dir)
    .then(plugins => plugins.map((src) => {
      return {
        src,
        mode: getPluginMode(src)
      }
    }))
}
