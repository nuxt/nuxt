import process from 'node:process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { relative, resolve } from 'pathe'
import { isDebug, isDevelopment, isTest } from 'std-env'
import { defu } from 'defu'
import { findWorkspaceDir } from 'pkg-types'

import type { NuxtDebugOptions } from '../types/debug.ts'
import type { NuxtModule } from '../types/module.ts'
import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  extends: undefined,
  compatibilityDate: undefined,
  theme: undefined,
  rootDir: {
    $resolve: val => typeof val === 'string' ? resolve(val) : process.cwd(),
  },
  workspaceDir: {
    $resolve: async (val, get) => {
      const rootDir = await get('rootDir')
      return val && typeof val === 'string'
        ? resolve(rootDir, val)
        : await findWorkspaceDir(rootDir, {
            gitConfig: 'closest',
            try: true,
          }).catch(() => rootDir)
    },
  },
  srcDir: {
    $resolve: async (val, get) => {
      if (val && typeof val === 'string') {
        return resolve(await get('rootDir'), val)
      }

      const rootDir = await get('rootDir')

      const srcDir = resolve(rootDir, 'app')
      if (!existsSync(srcDir)) {
        return rootDir
      }

      const srcDirFiles = new Set<string>()
      const files = await readdir(srcDir).catch(() => [])
      for (const file of files) {
        if (file !== 'spa-loading-template.html' && !file.startsWith('router.options')) {
          srcDirFiles.add(file)
        }
      }
      if (srcDirFiles.size === 0) {
        for (const file of ['app.vue', 'App.vue']) {
          if (existsSync(resolve(rootDir, file))) {
            return rootDir
          }
        }
        const keys = ['assets', 'layouts', 'middleware', 'pages', 'plugins'] as const
        const dirs = await Promise.all(keys.map(key => get(`dir.${key}`)))
        for (const dir of dirs) {
          if (existsSync(resolve(rootDir, dir))) {
            return rootDir
          }
        }
      }
      return srcDir
    },
  },
  serverDir: {
    $resolve: async (val, get) => {
      const rootDir = await get('rootDir')
      return resolve(rootDir, val && typeof val === 'string' ? val : 'server')
    },
  },
  buildDir: {
    $resolve: async (val, get) => {
      const rootDir = await get('rootDir')
      return resolve(rootDir, val && typeof val === 'string' ? val : '.nuxt')
    },
  },
  appId: {
    $resolve: val => val && typeof val === 'string' ? val : 'nuxt-app',
  },
  buildId: {
    $resolve: async (val, get): Promise<string> => {
      if (typeof val === 'string') { return val }

      const [isDev, isTest] = await Promise.all([get('dev') as Promise<boolean>, get('test') as Promise<boolean>])
      return isDev ? 'dev' : isTest ? 'test' : randomUUID()
    },
  },
  modulesDir: {
    $default: ['node_modules'],
    $resolve: async (val, get) => {
      const rootDir = await get('rootDir')
      const modulesDir = new Set<string>([resolve(rootDir, 'node_modules')])
      if (Array.isArray(val)) {
        for (const dir of val) {
          if (dir && typeof dir === 'string') {
            modulesDir.add(resolve(rootDir, dir))
          }
        }
      }
      return [...modulesDir]
    },
  },
  analyzeDir: {
    $resolve: async (val, get) => val && typeof val === 'string'
      ? resolve(await get('rootDir'), val)
      : resolve(await get('buildDir'), 'analyze'),
  },
  dev: {
    $resolve: val => typeof val === 'boolean' ? val : Boolean(isDevelopment),
  },
  test: {
    $resolve: val => typeof val === 'boolean' ? val : Boolean(isTest),
  },
  debug: {
    $resolve: (val) => {
      val ??= isDebug
      if (val === true) {
        return {
          templates: true,
          modules: true,
          watchers: true,
          hooks: {
            client: true,
            server: true,
          },
          nitro: true,
          router: true,
          hydration: true,
        } satisfies Required<NuxtDebugOptions>
      }
      if (val && typeof val === 'object') {
        return val
      }
      return false
    },
  },
  ssr: {
    $resolve: val => typeof val === 'boolean' ? val : true,
  },
  modules: {
    $resolve: (val) => {
      const modules: Array<string | NuxtModule | [NuxtModule | string, Record<string, any>]> = []
      if (Array.isArray(val)) {
        for (const mod of val) {
          if (!mod) {
            continue
          }
          if (typeof mod === 'string' || typeof mod === 'function' || (Array.isArray(mod) && mod[0])) {
            modules.push(mod)
          }
        }
      }
      return modules
    },
  },
  dir: {
    app: {
      $resolve: async (val, get) => {
        const [srcDir, rootDir] = await Promise.all([get('srcDir'), get('rootDir')])
        return resolve(await get('srcDir'), val && typeof val === 'string' ? val : (srcDir === rootDir ? 'app' : '.'))
      },
    },
    assets: 'assets',
    layouts: 'layouts',
    middleware: 'middleware',
    modules: {
      $resolve: async (val, get) => {
        return resolve(await get('rootDir'), val && typeof val === 'string' ? val : 'modules')
      },
    },
    pages: 'pages',
    plugins: 'plugins',
    shared: {
      $resolve: (val) => {
        return val && typeof val === 'string' ? val : 'shared'
      },
    },
    public: {
      $resolve: async (val, get) => {
        return resolve(await get('rootDir'), val && typeof val === 'string' ? val : 'public')
      },
    },
  },
  extensions: {
    $resolve: (val): string[] => {
      const extensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue']
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'string') {
            extensions.push(item)
          }
        }
      }
      return extensions
    },
  },
  alias: {
    $resolve: async (val, get) => {
      const [srcDir, rootDir, buildDir, sharedDir, serverDir] = await Promise.all([get('srcDir'), get('rootDir'), get('buildDir'), get('dir.shared'), get('serverDir')])
      const srcWithTrailingSlash = withTrailingSlash(srcDir)
      const rootWithTrailingSlash = withTrailingSlash(rootDir)
      return {
        '~': srcWithTrailingSlash,
        '@': srcWithTrailingSlash,
        '~~': rootWithTrailingSlash,
        '@@': rootWithTrailingSlash,
        '#shared': withTrailingSlash(resolve(rootDir, sharedDir)),
        '#server': withTrailingSlash(serverDir),
        '#build': withTrailingSlash(buildDir),
        '#internal/nuxt/paths': resolve(buildDir, 'paths.mjs'),
        ...typeof val === 'object' ? val : {},
      }
    },
  },
  ignoreOptions: undefined,
  ignorePrefix: {
    $resolve: val => val && typeof val === 'string' ? val : '-',
  },
  ignore: {
    $resolve: async (val, get): Promise<string[]> => {
      const [rootDir, ignorePrefix, analyzeDir, buildDir] = await Promise.all([get('rootDir'), get('ignorePrefix'), get('analyzeDir'), get('buildDir')])
      const ignore = new Set<string>([
        '**/*.stories.{js,cts,mts,ts,jsx,tsx}', // ignore storybook files
        '**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}', // ignore tests
        '**/*.d.{cts,mts,ts}', // ignore type declarations
        '**/*.d.vue.{cts,mts,ts}',
        '**/.{pnpm-store,vercel,netlify,output,git,cache,data}',
        '**/node-compile-cache',
        '**/test-results',
        '**/*.sock',
        relative(rootDir, analyzeDir),
        relative(rootDir, buildDir),
      ])
      if (ignorePrefix) {
        ignore.add(`**/${ignorePrefix}*.*`)
      }
      if (Array.isArray(val)) {
        for (const pattern of val) {
          if (pattern) {
            ignore.add(pattern)
          }
        }
      }
      return [...ignore]
    },
  },
  watch: {
    $resolve: (val) => {
      if (Array.isArray(val)) {
        return val.filter((b: unknown) => typeof b === 'string' || b instanceof RegExp)
      }
      return []
    },
  },
  watchers: {
    rewatchOnRawEvents: undefined,
    webpack: {
      aggregateTimeout: 1000,
    },
    chokidar: {
      ignoreInitial: true,
      ignorePermissionErrors: true,
    },
  },
  hooks: undefined,
  runtimeConfig: {
    $resolve: async (_val, get) => {
      const val = _val && typeof _val === 'object' ? _val : {}
      const [app, buildId] = await Promise.all([get('app'), get('buildId')])
      provideFallbackValues(val)
      return defu(val, {
        public: {},
        app: {
          buildId,
          baseURL: app.baseURL,
          buildAssetsDir: app.buildAssetsDir,
          cdnURL: app.cdnURL,
        },
      })
    },
  },
  appConfig: {
    nuxt: {},
  },

  $schema: {},
})

function provideFallbackValues (obj: Record<string, any>) {
  for (const key in obj) {
    if (typeof obj[key] === 'undefined' || obj[key] === null) {
      obj[key] = ''
    } else if (typeof obj[key] === 'object') {
      provideFallbackValues(obj[key])
    }
  }
}

function withTrailingSlash (str: string) {
  return str.replace(/\/?$/, '/')
}
