import type { NuxtOptions } from '@nuxt/schema'

import { isObject, objectOrEmpty } from '../validate.ts'
import type { RawConfig } from '../validate.ts'

type NitroKeys =
  | 'routeRules' | 'prerender' | 'nitroLegacy' | 'serverHandlers' | 'devServerHandlers'
  | '_serverPlugins' | '_rendererPlugins' | '_serverTemplates' | 'tracingChannel' | 'nitro'

export type NitroOptions = Pick<NuxtOptions, NitroKeys>

export function resolveNitro (input: RawConfig, resolved: Pick<NuxtOptions, 'runtimeConfig'>): NitroOptions {
  const routeRules = input.routeRules === undefined ? {} : input.routeRules
  const prerender = input.prerender === undefined ? {} : input.prerender
  const tracingChannel = resolveTracingChannel(input.tracingChannel)
  const nitro = objectOrEmpty(input.nitro)
  const { runtimeConfig } = resolved

  return {
    routeRules,
    prerender,
    nitroLegacy: input.nitroLegacy === true ? true : isObject(input.nitroLegacy) ? input.nitroLegacy : false,
    serverHandlers: input.serverHandlers === undefined ? [] : input.serverHandlers,
    devServerHandlers: input.devServerHandlers === undefined ? [] : input.devServerHandlers,
    _serverPlugins: input._serverPlugins === undefined ? [] : input._serverPlugins,
    _rendererPlugins: input._rendererPlugins === undefined ? [] : input._rendererPlugins,
    _serverTemplates: input._serverTemplates === undefined ? {} : input._serverTemplates,
    tracingChannel,
    nitro: {
      ...nitro,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      runtimeConfig: {
        ...runtimeConfig,
        app: {
          ...runtimeConfig.app,
          baseURL: runtimeConfig.app.baseURL.startsWith('./')
            ? runtimeConfig.app.baseURL.slice(1)
            : runtimeConfig.app.baseURL,
        },
        nitro: Object.assign({ envPrefix: 'NUXT_' }, runtimeConfig.nitro),
      },
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      routeRules: {
        ...routeRules,
        ...objectOrEmpty(nitro.routeRules),
      },
      prerender: {
        ...prerender,
        ...objectOrEmpty(nitro.prerender),
      },
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      tracingChannel: resolveNitroTracingChannel(nitro.tracingChannel, tracingChannel),
    },
  } as NitroOptions
}

function resolveTracingChannel (value: unknown): NuxtOptions['tracingChannel'] {
  if (value === true) {
    return { nuxt: true, srvx: true, h3: true, unstorage: true }
  }
  if (isObject(value)) {
    return { nuxt: true, srvx: true, h3: true, unstorage: true, ...value }
  }
  return false
}

function resolveNitroTracingChannel (value: unknown, topLevel: NuxtOptions['tracingChannel']) {
  if (value === false) {
    return false
  }
  const base = typeof topLevel === 'object' ? topLevel : null
  const override = isObject(value) ? value : null
  if (!base && !override) {
    return value === true ? {} : false
  }
  return { ...base, ...override }
}
