import process from 'node:process'
import { resolve } from 'pathe'
import { defu } from 'defu'
import type { AppHeadMetaObject, NuxtAppConfig, NuxtOptions, ViewTransitionOptions } from '@nuxt/schema'

import { optionsDiagnostics } from '../diagnostics.ts'
import { bool, isObject, isPlainObject, objectOrEmpty, string, withDefaults } from '../validate.ts'
import type { RawConfig } from '../validate.ts'

export type AppOptions = Pick<NuxtOptions, 'vue' | 'app' | 'spaLoadingTemplate' | 'plugins' | 'css' | 'unhead' | 'runtimeConfig'>

export function resolveApp (input: RawConfig, resolved: Pick<NuxtOptions, 'dev' | 'srcDir' | 'buildId'>): AppOptions {
  const app = resolveAppNamespace(input.app, input.experimental?.viewTransition, resolved.dev)
  return {
    vue: resolveVue(input.vue),
    app,
    spaLoadingTemplate: typeof input.spaLoadingTemplate === 'string'
      ? resolve(resolved.srcDir, input.spaLoadingTemplate)
      : typeof input.spaLoadingTemplate === 'boolean' ? input.spaLoadingTemplate : null,
    plugins: input.plugins === undefined ? [] : input.plugins,
    css: Array.isArray(input.css) ? input.css.filter((item: unknown) => typeof item === 'string') : [],
    unhead: resolveUnhead(input.unhead),
    runtimeConfig: resolveRuntimeConfig(input.runtimeConfig, app, resolved.buildId),
  }
}

function resolveVue (value: unknown): NuxtOptions['vue'] {
  const vue = withDefaults('vue', value, {
    transformAssetUrls: {
      video: ['src', 'poster'],
      source: ['src'],
      img: ['src'],
      image: ['xlink:href', 'href'],
      use: ['xlink:href', 'href'],
    },
    compilerOptions: {},
    propsDestructure: true,
    config: {},
  })
  return {
    ...vue,
    runtimeCompiler: bool('vue.runtimeCompiler', vue.runtimeCompiler, false),
    optionsApi: bool('vue.optionsApi', vue.optionsApi, false),
    vapor: bool('vue.vapor', vue.vapor, false),
  } as NuxtOptions['vue']
}

type NormalizedMetaObject = Required<Pick<AppHeadMetaObject, 'meta' | 'link' | 'style' | 'script' | 'noscript'>>

function resolveAppNamespace (value: unknown, experimentalViewTransition: unknown, dev: boolean): NuxtOptions['app'] {
  const app = withDefaults('app', value, {
    layoutTransition: false,
    pageTransition: false,
    keepalive: false,
    spaLoaderAttrs: { id: '__nuxt-loader' },
  })

  const buildAssetsDir = typeof app.buildAssetsDir === 'string' ? app.buildAssetsDir : (process.env.NUXT_APP_BUILD_ASSETS_DIR || '/_nuxt/')
  const rootId = app.rootId === false ? false : string('app.rootId', app.rootId, '__nuxt')
  const teleportId = app.teleportId === false ? false : string('app.teleportId', app.teleportId, 'teleports')

  return {
    ...app,
    baseURL: typeof app.baseURL === 'string' ? app.baseURL : (process.env.NUXT_APP_BASE_URL || '/'),
    // normalised so consumers can compare it directly against request paths
    buildAssetsDir: buildAssetsDir.replace(/^\/?/, '/').replace(/\/?$/, '/'),
    cdnURL: dev ? '' : (process.env.NUXT_APP_CDN_URL || (typeof app.cdnURL === 'string' ? app.cdnURL : '')),
    head: resolveHead(app.head),
    viewTransition: resolveViewTransition(app.viewTransition, experimentalViewTransition),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    rootId,
    rootTag: string('app.rootTag', app.rootTag, 'div'),
    rootAttrs: {
      id: rootId === false ? undefined : rootId,
      ...objectOrEmpty(app.rootAttrs),
    },
    teleportTag: string('app.teleportTag', app.teleportTag, 'div'),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    teleportId,
    teleportAttrs: {
      id: teleportId === false ? undefined : teleportId,
      ...objectOrEmpty(app.teleportAttrs),
    },
    spaLoaderTag: string('app.spaLoaderTag', app.spaLoaderTag, 'div'),
  } as NuxtOptions['app']
}

function resolveHead (value: unknown): NuxtAppConfig['head'] & NormalizedMetaObject {
  const head: NuxtAppConfig['head'] & NormalizedMetaObject = defu(objectOrEmpty(value), {
    meta: [],
    link: [],
    style: [],
    script: [],
    noscript: [],
  } satisfies NormalizedMetaObject)

  // provides default charset and viewport if not set
  if (!head.meta.find(m => m?.charset)?.charset) {
    head.meta.unshift({ charset: head.charset || 'utf-8' })
  }
  if (!head.meta.find(m => m?.name === 'viewport')?.content) {
    head.meta.unshift({ name: 'viewport', content: head.viewport || 'width=device-width, initial-scale=1' })
  }

  head.meta = head.meta.filter(Boolean)
  head.link = head.link.filter(Boolean)
  head.style = head.style.filter(Boolean)
  head.script = head.script.filter(Boolean)
  head.noscript = head.noscript.filter(Boolean)

  return head
}

function resolveViewTransition (value: unknown, experimentalValue: unknown): ViewTransitionOptions {
  const options: Partial<ViewTransitionOptions> = {
    enabled: value === 'always' || typeof value === 'boolean'
      ? value
      : isObject(value) && 'enabled' in value ? value.enabled : undefined,
    types: isObject(value) && 'types' in value ? value.types : undefined,
  }
  if (options.enabled !== undefined && options.types !== undefined) {
    return options as ViewTransitionOptions
  }

  const experimental = experimentalValue ?? false
  const fallback: Partial<ViewTransitionOptions> = isObject(experimental) ? experimental : { enabled: experimental as ViewTransitionOptions['enabled'] }
  return {
    enabled: options.enabled ?? fallback.enabled!,
    types: options.types ?? fallback.types,
  }
}

function resolveUnhead (value: unknown): NuxtOptions['unhead'] {
  const unhead = withDefaults('unhead', value, { vite: {} })
  if (unhead.legacy === true) {
    optionsDiagnostics.NUXT_B5013()
  }
  return {
    ...unhead,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    legacy: false,
    renderSSRHeadOptions: {
      omitLineBreaks: true,
      ...objectOrEmpty(unhead.renderSSRHeadOptions),
    },
  } as NuxtOptions['unhead']
}

function resolveRuntimeConfig (value: unknown, app: NuxtOptions['app'], buildId: string): NuxtOptions['runtimeConfig'] {
  return defu(isObject(value) ? withFallbackValues(value) : {}, {
    appSecret: '',
    public: {},
    app: {
      buildId,
      baseURL: app.baseURL,
      buildAssetsDir: app.buildAssetsDir,
      cdnURL: app.cdnURL,
    },
  }) as NuxtOptions['runtimeConfig']
}

function withFallbackValues (value: Record<string, any>): Record<string, any> {
  const copy: Record<string, any> = Array.isArray(value) ? [] : {}
  for (const key in value) {
    const entry = value[key]
    copy[key] = entry == null
      ? ''
      : Array.isArray(entry) || isPlainObject(entry) ? withFallbackValues(entry) : entry
  }
  return copy
}
