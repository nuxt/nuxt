
import { NuxtApp } from './app'
import { Builder } from './builder'
import { resolveFiles } from './utils'

export interface NuxtPlugin {
  src: string
  mode: 'server' | 'client' | 'all'
}

const MODES_REGEX = /\.(server|client)(\.\w+)*$/
const getPluginMode = (src: string) => {
  const [, mode = 'all'] = src.match(MODES_REGEX) || []

  return mode as NuxtPlugin['mode']
}

export async function resolvePlugins (builder: Builder, app: NuxtApp) {
  const plugins = await resolveFiles(builder, 'plugins/**/*.{js,ts}', app.dir)

  return plugins.map(src => ({
    src,
    mode: getPluginMode(src)
  })
  )
}
