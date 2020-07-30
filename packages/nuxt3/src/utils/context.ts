import type { ServerResponse } from 'http'
import type { IncomingMessage } from 'connect'

import { TARGETS } from './constants'

export const getContext = function getContext (req: IncomingMessage, res: ServerResponse) {
  return { req, res }
}

type NuxtGlobal = string | ((globalName: string) => string)

type Globals = 'id' | 'nuxt' | 'context' | 'pluginPrefix' | 'readyCallback' | 'loadedCallback'

type NuxtGlobals = {
  [key in Globals]: NuxtGlobal
}

export type DeterminedGlobals = {
  [key in keyof NuxtGlobals]: string
}

export const determineGlobals = function determineGlobals (globalName: string, globals: NuxtGlobals) {
  const _globals: Partial<DeterminedGlobals> = {}
  for (const global in globals) {
    const currentGlobal = globals[global]
    if (currentGlobal instanceof Function) {
      _globals[global] = currentGlobal(globalName)
    } else {
      _globals[global] = currentGlobal
    }
  }
  return _globals as DeterminedGlobals
}

export const isFullStatic = function (options) {
  return !options.dev && !options._legacyGenerate && options.target === TARGETS.static && options.render.ssr
}
