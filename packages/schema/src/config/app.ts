import process from 'node:process'
import { defu } from 'defu'
import { resolve } from 'pathe'
import { defineResolvers } from '../utils/definition.ts'
import type { AppHeadMetaObject } from '../types/head.ts'
import type { NuxtAppConfig } from '../types/config.ts'

export default defineResolvers({
  vue: {
    transformAssetUrls: {
      video: ['src', 'poster'],
      source: ['src'],
      img: ['src'],
      image: ['xlink:href', 'href'],
      use: ['xlink:href', 'href'],
    },
    compilerOptions: {},
    runtimeCompiler: {
      $resolve: (val) => {
        return typeof val === 'boolean' ? val : false
      },
    },
    propsDestructure: true,

    config: {},
  },
  app: {
    baseURL: {
      $resolve: (val) => {
        if (typeof val === 'string') {
          return val
        }
        return process.env.NUXT_APP_BASE_URL || '/'
      },
    },
    buildAssetsDir: {
      $resolve: (val) => {
        if (typeof val === 'string') {
          return val
        }
        return process.env.NUXT_APP_BUILD_ASSETS_DIR || '/_nuxt/'
      },
    },

    cdnURL: {
      $resolve: async (val, get) => {
        if (await get('dev')) {
          return ''
        }
        return process.env.NUXT_APP_CDN_URL || (typeof val === 'string' ? val : '')
      },
    },

    head: {
      $resolve: (_val) => {
        const val: Partial<NuxtAppConfig['head']> = _val && typeof _val === 'object' ? _val : {}

        type NormalizedMetaObject = Required<Pick<AppHeadMetaObject, 'meta' | 'link' | 'style' | 'script' | 'noscript'>>

        const resolved: NuxtAppConfig['head'] & NormalizedMetaObject = defu(val, {
          meta: [],
          link: [],
          style: [],
          script: [],
          noscript: [],
        } satisfies NormalizedMetaObject)

        // provides default charset and viewport if not set
        if (!resolved.meta.find(m => m?.charset)?.charset) {
          resolved.meta.unshift({ charset: resolved.charset || 'utf-8' })
        }
        if (!resolved.meta.find(m => m?.name === 'viewport')?.content) {
          resolved.meta.unshift({ name: 'viewport', content: resolved.viewport || 'width=device-width, initial-scale=1' })
        }

        resolved.meta = resolved.meta.filter(Boolean)
        resolved.link = resolved.link.filter(Boolean)
        resolved.style = resolved.style.filter(Boolean)
        resolved.script = resolved.script.filter(Boolean)
        resolved.noscript = resolved.noscript.filter(Boolean)

        return resolved
      },
    },
    layoutTransition: false,
    pageTransition: false,
    viewTransition: {
      $resolve: async (val, get) => {
        if (val === 'always' || typeof val === 'boolean') {
          return val
        }

        return await get('experimental').then(e => e.viewTransition) ?? false
      },
    },
    keepalive: false,
    rootId: {
      $resolve: val => val === false ? false : (val && typeof val === 'string' ? val : '__nuxt'),
    },
    rootTag: {
      $resolve: val => val && typeof val === 'string' ? val : 'div',
    },
    rootAttrs: {
      $resolve: async (val, get) => {
        const rootId = await get('app.rootId')
        return {
          id: rootId === false ? undefined : (rootId || '__nuxt'),
          ...typeof val === 'object' ? val : {},
        }
      },
    },
    teleportTag: {
      $resolve: val => val && typeof val === 'string' ? val : 'div',
    },
    teleportId: {
      $resolve: val => val === false ? false : (val && typeof val === 'string' ? val : 'teleports'),
    },
    teleportAttrs: {
      $resolve: async (val, get) => {
        const teleportId = await get('app.teleportId')
        return {
          id: teleportId === false ? undefined : (teleportId || 'teleports'),
          ...typeof val === 'object' ? val : {},
        }
      },
    },
    spaLoaderTag: {
      $resolve: val => val && typeof val === 'string' ? val : 'div',
    },
    spaLoaderAttrs: {
      id: '__nuxt-loader',
    },
    importMap: {
      $resolve: (val) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const result: Record<string, string> = {}
          for (const [key, value] of Object.entries(val)) {
            if (typeof value === 'string') {
              result[key] = value
            }
          }
          return result
        }
        return {}
      },
    },
  },
  spaLoadingTemplate: {
    $resolve: async (val, get) => {
      if (typeof val === 'string') {
        return resolve(await get('srcDir'), val)
      }
      if (typeof val === 'boolean') {
        return val
      }
      return null
    },
  },
  plugins: [],
  css: {
    $resolve: (val) => {
      if (!Array.isArray(val)) {
        return []
      }
      const css: string[] = []
      for (const item of val) {
        if (typeof item === 'string') {
          css.push(item)
        }
      }
      return css
    },
  },
  unhead: {
    legacy: false,
    renderSSRHeadOptions: {
      $resolve: val => ({
        omitLineBreaks: true,
        ...typeof val === 'object' ? val : {},
      }),
    },
  },
})
