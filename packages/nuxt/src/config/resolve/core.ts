import process from 'node:process'
import { join, relative, resolve } from 'pathe'
import { defu } from 'defu'
import type { NuxtModule, NuxtOptions } from '@nuxt/schema'

import { DEFAULT_JS_FILE_EXTENSIONS } from '../constants.ts'
import { optionsDiagnostics } from '../diagnostics.ts'
import { template as loadingTemplate } from '../templates/loading.ts'
import { bool, isObject, objectOrEmpty, string, withDefaults } from '../validate.ts'
import type { RawConfig } from '../validate.ts'
import type { PathOptions } from './paths.ts'
import type { EnvOptions } from './env.ts'

type CoreKeys =
  | 'appId' | 'modules' | 'extensions' | 'alias' | 'ignorePrefix' | 'ignore' | 'watch' | 'watchers' | 'appConfig'
  | 'components' | 'imports' | 'devtools' | 'builder' | 'server' | 'sourcemap' | 'build' | 'optimization'
  | 'devServer' | 'typescript' | 'postcss' | 'router'

export type CoreOptions = Pick<NuxtOptions, CoreKeys>

const BUILDERS = {
  rsbuild: '@nuxt/rsbuild-builder',
  rspack: '@nuxt/rspack-builder',
  vite: '@nuxt/vite-builder',
  webpack: '@nuxt/webpack-builder',
} as const

const SERVER_BUILDERS = {
  nitro: '@nuxt/nitro-server',
  vite: '@nuxt/vite-server',
} as const

export function resolveCore (input: RawConfig, resolved: PathOptions & EnvOptions): CoreOptions {
  const { rootDir, srcDir, buildDir, serverDir, analyzeDir, dev } = resolved

  const ignorePrefix = string('ignorePrefix', input.ignorePrefix, '-')

  return {
    appId: string('appId', input.appId, 'nuxt-app'),
    modules: resolveModules(input.modules),
    extensions: [
      ...DEFAULT_JS_FILE_EXTENSIONS,
      '.vue',
      ...Array.isArray(input.extensions) ? input.extensions.filter((item: unknown) => item && typeof item === 'string') : [],
    ],
    alias: {
      '~': withTrailingSlash(srcDir),
      '@': withTrailingSlash(srcDir),
      '~~': withTrailingSlash(rootDir),
      '@@': withTrailingSlash(rootDir),
      '#shared': withTrailingSlash(resolve(rootDir, resolved.dir.shared)),
      '#server': withTrailingSlash(serverDir),
      '#build': withTrailingSlash(buildDir),
      '#internal/nuxt/paths': resolve(buildDir, 'paths.mjs'),
      ...objectOrEmpty(input.alias),
    },
    ignorePrefix,
    ignore: [...new Set([
      '**/*.stories.{js,cts,mts,ts,jsx,tsx}',
      '**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}',
      '**/*.d.{cts,mts,ts}',
      '**/*.d.vue.{cts,mts,ts}',
      '**/.{pnpm-store,vercel,netlify,wrangler,output,git,cache,data,direnv}',
      '/vendor',
      '**/node-compile-cache',
      '**/test-results',
      '**/*.sock',
      relative(rootDir, analyzeDir),
      relative(rootDir, buildDir),
      `**/${ignorePrefix}*.*`,
      ...Array.isArray(input.ignore) ? input.ignore.filter(Boolean) : [],
    ])],
    watch: Array.isArray(input.watch) ? input.watch.filter((item: unknown) => typeof item === 'string' || item instanceof RegExp) : [],
    watchers: withDefaults('watchers', input.watchers, {
      webpack: { aggregateTimeout: 1000 },
      chokidar: { ignoreInitial: true, ignorePermissionErrors: true },
    }) as NuxtOptions['watchers'],
    appConfig: withDefaults('appConfig', input.appConfig, { nuxt: {} }),
    components: resolveComponents(input.components),
    imports: withDefaults('imports', input.imports, { global: false, scan: true, dirs: [] }),
    devtools: input.devtools === undefined ? {} : input.devtools,
    builder: resolveBuilder(input.builder),
    server: {
      ...objectOrEmpty(input.server),
      builder: resolveServerBuilder(input.server?.builder),
    },
    sourcemap: typeof input.sourcemap === 'boolean'
      ? { server: input.sourcemap, client: input.sourcemap }
      : { server: true, client: dev, ...objectOrEmpty(input.sourcemap) },
    build: resolveBuild(input.build, rootDir, analyzeDir),
    optimization: resolveOptimization(input.optimization, dev),
    devServer: resolveDevServer(input.devServer, input.vite?.server?.allowedHosts),
    typescript: resolveTypeScript(input.typescript),
    postcss: {
      ...withDefaults('postcss', input.postcss, { plugins: {} }),
      order: resolvePostcssOrder(input.postcss?.order),
    } as NuxtOptions['postcss'],
    router: resolveRouter(input.router),
  }
}

function withTrailingSlash (path: string): string {
  return path.replace(/\/?$/, '/')
}

function resolveModules (value: unknown): NuxtOptions['modules'] {
  const modules: Array<string | NuxtModule | [NuxtModule | string, Record<string, any>]> = []
  if (Array.isArray(value)) {
    for (const mod of value) {
      if (mod && (typeof mod === 'string' || typeof mod === 'function' || (Array.isArray(mod) && mod[0]))) {
        modules.push(mod)
      }
    }
  }
  return modules
}

function resolveComponents (value: unknown): NuxtOptions['components'] {
  if (Array.isArray(value)) {
    return { dirs: value }
  }
  if (value === false) {
    return { dirs: [] }
  }
  return {
    dirs: [{ path: '~/components/global', global: true }, '~/components'],
    ...objectOrEmpty(value),
  }
}

function resolveBuilder (value: unknown): NuxtOptions['builder'] {
  if (isObject(value) && 'bundle' in value) {
    return value as Extract<NuxtOptions['builder'], object>
  }
  if (typeof value === 'string' && value in BUILDERS) {
    return BUILDERS[value as keyof typeof BUILDERS]
  }
  return BUILDERS.vite
}

function resolveServerBuilder (value: unknown): NuxtOptions['server']['builder'] {
  if (typeof value === 'string') {
    return SERVER_BUILDERS[value as keyof typeof SERVER_BUILDERS] ?? value
  }
  if (isObject(value) && 'bundle' in value) {
    return value as Extract<NuxtOptions['server']['builder'], object>
  }
  return SERVER_BUILDERS.nitro
}

function resolveBuild (value: unknown, rootDir: string, analyzeDir: string): NuxtOptions['build'] {
  const build = objectOrEmpty(value)
  const transpile: NuxtOptions['build']['transpile'] = []
  if (Array.isArray(build.transpile)) {
    for (const pattern of build.transpile) {
      if (pattern && (typeof pattern === 'string' || typeof pattern === 'function' || pattern instanceof RegExp)) {
        transpile.push(pattern)
      }
    }
  }
  return {
    ...build,
    transpile,
    templates: build.templates === undefined ? [] : build.templates,
    analyze: {
      template: 'treemap',
      projectRoot: rootDir,
      filename: join(analyzeDir, '{name}.html'),
      ...typeof build.analyze === 'boolean' ? { enabled: build.analyze } : objectOrEmpty(build.analyze),
    },
  }
}

function resolveOptimization (value: unknown, dev: boolean): NuxtOptions['optimization'] {
  const optimization = objectOrEmpty(value)
  const composables = objectOrEmpty(optimization.treeShake?.composables)
  return {
    ...optimization,
    keyedComposables: [
      { name: 'callOnce', argumentLength: 3, source: '#app/composables/once' },
      { name: 'defineNuxtComponent', argumentLength: 2, source: '#app/composables/component' },
      { name: 'useState', argumentLength: 2, source: '#app/composables/state' },
      { name: 'useFetch', argumentLength: 3, source: '#app/composables/fetch' },
      { name: 'useAsyncData', argumentLength: 3, source: '#app/composables/asyncData' },
      { name: 'useLazyAsyncData', argumentLength: 3, source: '#app/composables/asyncData' },
      { name: 'useLazyFetch', argumentLength: 3, source: '#app/composables/fetch' },
      ...Array.isArray(optimization.keyedComposables) ? optimization.keyedComposables.filter(Boolean) : [],
    ],
    keyedComposableFactories: [
      { name: 'createUseFetch', source: '#app/composables/fetch', argumentLength: 3 },
      { name: 'createUseAsyncData', source: '#app/composables/asyncData', argumentLength: 3 },
      ...Array.isArray(optimization.keyedComposableFactories) ? optimization.keyedComposableFactories.filter(Boolean) : [],
    ],
    treeShake: {
      ...objectOrEmpty(optimization.treeShake),
      composables: {
        ...composables,
        server: defu(objectOrEmpty(composables.server), dev
          ? {}
          : {
              'vue': ['onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount', 'onBeforeUpdate', 'onBeforeUnmount', 'onRenderTracked', 'onRenderTriggered', 'onActivated', 'onDeactivated'],
              '#app': ['definePayloadReviver', 'definePageMeta'],
            }),
        client: defu(objectOrEmpty(composables.client), dev
          ? {}
          : {
              'vue': ['onRenderTracked', 'onRenderTriggered', 'onServerPrefetch'],
              '#app': ['definePayloadReducer', 'definePageMeta', 'onPrehydrate'],
            }),
      },
    },
    asyncTransforms: withDefaults('optimization.asyncTransforms', optimization.asyncTransforms, {
      asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
      objectDefinitions: {
        defineNuxtComponent: ['asyncData', 'setup'],
        defineNuxtPlugin: ['setup'],
        definePageMeta: ['middleware', 'validate'],
      },
    }),
  }
}

function resolveDevServer (value: unknown, viteAllowedHosts: unknown): NuxtOptions['devServer'] {
  const devServer = withDefaults('devServer', value, {
    https: false,
    port: Number(process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3000),
    url: 'http://localhost:3000',
    loadingTemplate,
    errorChannel: '/__nuxt_dev__/error',
    cors: {
      origin: [/^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/],
    },
  })
  const host = typeof devServer.host === 'string' && devServer.host
    ? devServer.host
    : process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || undefined

  let allowedHosts: true | string[] = true
  if (devServer.allowedHosts !== true && viteAllowedHosts !== true) {
    const hosts = [
      ...Array.isArray(devServer.allowedHosts) ? devServer.allowedHosts : [],
      ...Array.isArray(viteAllowedHosts) ? viteAllowedHosts : [],
      host,
    ]
    allowedHosts = [...new Set(hosts.filter((h): h is string => typeof h === 'string' && !!h))]
  }

  return { ...devServer, host, allowedHosts } as NuxtOptions['devServer']
}

const TYPESCRIPT_BUILDERS = ['vite', 'webpack', 'rsbuild', 'rspack', 'shared'] as const

const HOISTED_TYPES = [
  '@unhead/vue',
  '@nuxt/devtools',
  'vue',
  '@vue/runtime-core',
  '@vue/compiler-sfc',
  'vue-router',
  'vue-router/auto-routes',
  '@nuxt/schema',
  'nuxt',
]

function resolveTypeScript (value: unknown): NuxtOptions['typescript'] {
  const typescript = withDefaults('typescript', value, {
    strict: true,
    includeWorkspace: false,
    typeCheck: false,
    tsConfig: {},
    shim: false,
  })
  const builder = typescript.builder
  return {
    ...typescript,
    builder: TYPESCRIPT_BUILDERS.includes(builder) ? builder : builder === false ? false : null,
    hoist: typescript.hoist === false ? [] : Array.isArray(typescript.hoist) ? typescript.hoist.concat(HOISTED_TYPES) : [...HOISTED_TYPES],
  } as NuxtOptions['typescript']
}

function ensureItemIsLast (item: string) {
  return (names: string[]) => {
    const index = names.indexOf(item)
    if (index !== -1) {
      names.splice(index, 1)
      names.push(item)
    }
    return names
  }
}

const POSTCSS_ORDER_PRESETS = {
  cssnanoLast: ensureItemIsLast('cssnano'),
  autoprefixerLast: ensureItemIsLast('autoprefixer'),
  autoprefixerAndCssnanoLast (names: string[]) {
    return POSTCSS_ORDER_PRESETS.cssnanoLast(POSTCSS_ORDER_PRESETS.autoprefixerLast(names))
  },
}

function resolvePostcssOrder (value: unknown): NuxtOptions['postcss']['order'] {
  if (typeof value === 'string') {
    if (!(value in POSTCSS_ORDER_PRESETS)) {
      throw optionsDiagnostics.NUXT_B5015({ preset: value }, { method: 'error' })
    }
    return POSTCSS_ORDER_PRESETS[value as keyof typeof POSTCSS_ORDER_PRESETS]
  }
  if (typeof value === 'function' || Array.isArray(value)) {
    return value as NuxtOptions['postcss']['order']
  }
  return POSTCSS_ORDER_PRESETS.autoprefixerAndCssnanoLast
}

function resolveRouter (value: unknown): NuxtOptions['router'] {
  const router = withDefaults('router', value, {
    options: { hashMode: false, scrollBehaviorType: 'auto' },
  })
  return {
    ...router,
    options: {
      ...router.options,
      sensitive: bool('router.options.sensitive', router.options.sensitive, true),
    },
  }
}
