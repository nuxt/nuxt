import { dirname, join, relative, resolve } from 'upath'
import { InputOptions, OutputOptions } from 'rollup'
import defu from 'defu'
import { terser } from 'rollup-plugin-terser'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import alias from '@rollup/plugin-alias'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import virtual from '@rollup/plugin-virtual'
import inject from '@rollup/plugin-inject'
import analyze from 'rollup-plugin-analyzer'
import type { Preset } from '@nuxt/un'
import * as un from '@nuxt/un'

import { NitroContext } from '../context'
import { resolvePath, MODULE_DIR } from '../utils'

import { dynamicRequire } from './plugins/dynamic-require'
import { externals } from './plugins/externals'
import { timing } from './plugins/timing'
import { autoMock } from './plugins/automock'
import { staticAssets, dirnames } from './plugins/static'
import { middleware } from './plugins/middleware'
import { esbuild } from './plugins/esbuild'
import { raw } from './plugins/raw'

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (nitroContext: NitroContext) => {
  const extensions: string[] = ['.ts', '.mjs', '.js', '.json', '.node']

  const nodePreset = nitroContext.node === false ? un.nodeless : un.node

  const builtinPreset: Preset = {
    alias: {
      // General
      debug: 'un/npm/debug',
      depd: 'un/npm/depd',
      // Vue 2
      encoding: 'un/mock/proxy',
      he: 'un/mock/proxy',
      resolve: 'un/mock/proxy',
      'source-map': 'un/mock/proxy',
      'lodash.template': 'un/mock/proxy',
      'serialize-javascript': 'un/mock/proxy',
      // Vue 3
      '@babel/parser': 'un/mock/proxy',
      '@vue/compiler-core': 'un/mock/proxy',
      '@vue/compiler-dom': 'un/mock/proxy',
      '@vue/compiler-ssr': 'un/mock/proxy'
    }
  }

  const env = un.env(nodePreset, builtinPreset, nitroContext.env)

  delete env.alias['node-fetch'] // FIX ME

  if (nitroContext.sourceMap) {
    env.polyfill.push('source-map-support/register')
  }

  const buildServerDir = join(nitroContext._nuxt.buildDir, 'dist/server')
  const runtimeAppDir = join(nitroContext._internal.runtimeDir, 'app')

  const rollupConfig: RollupConfig = {
    input: resolvePath(nitroContext, nitroContext.entry),
    output: {
      dir: nitroContext.output.serverDir,
      entryFileNames: 'index.js',
      chunkFileNames (chunkInfo) {
        let prefix = ''
        const modules = Object.keys(chunkInfo.modules)
        const lastModule = modules[modules.length - 1]
        if (lastModule.startsWith(buildServerDir)) {
          prefix = join('app', relative(buildServerDir, dirname(lastModule)))
        } else if (lastModule.startsWith(runtimeAppDir)) {
          prefix = 'app'
        } else if (lastModule.startsWith(nitroContext._nuxt.buildDir)) {
          prefix = 'nuxt'
        } else if (lastModule.startsWith(nitroContext._internal.runtimeDir)) {
          prefix = 'nitro'
        } else if (!prefix && nitroContext.middleware.find(m => lastModule.startsWith(m.handle))) {
          prefix = 'middleware'
        }
        return join('chunks', prefix, '[name].js')
      },
      inlineDynamicImports: nitroContext.inlineDynamicImports,
      format: 'cjs',
      exports: 'auto',
      intro: '',
      outro: '',
      preferConst: true,
      sourcemap: nitroContext.sourceMap,
      sourcemapExcludeSources: true,
      sourcemapPathTransform (relativePath, sourcemapPath) {
        return resolve(dirname(sourcemapPath), relativePath)
      }
    },
    external: env.external,
    plugins: [],
    onwarn (warning, rollupWarn) {
      if (!['CIRCULAR_DEPENDENCY', 'EVAL'].includes(warning.code)) {
        rollupWarn(warning)
      }
    }
  }

  if (nitroContext.timing) {
    rollupConfig.plugins.push(timing())
  }

  // Raw asset loader
  rollupConfig.plugins.push(raw())

  // https://github.com/rollup/plugins/tree/master/packages/replace
  rollupConfig.plugins.push(replace({
    // @ts-ignore https://github.com/rollup/plugins/pull/810
    preventAssignment: true,
    values: {
      'process.env.NODE_ENV': nitroContext._nuxt.dev ? '"development"' : '"production"',
      'typeof window': '"undefined"',
      'process.env.ROUTER_BASE': JSON.stringify(nitroContext._nuxt.routerBase),
      'process.env.PUBLIC_PATH': JSON.stringify(nitroContext._nuxt.publicPath),
      'process.env.NUXT_STATIC_BASE': JSON.stringify(nitroContext._nuxt.staticAssets.base),
      'process.env.NUXT_STATIC_VERSION': JSON.stringify(nitroContext._nuxt.staticAssets.version),
      'process.env.NUXT_FULL_STATIC': nitroContext._nuxt.fullStatic as unknown as string,
      'process.env.NITRO_PRESET': JSON.stringify(nitroContext.preset),
      'process.env.RUNTIME_CONFIG': JSON.stringify(nitroContext._nuxt.runtimeConfig),
      'process.env.DEBUG': JSON.stringify(nitroContext._nuxt.dev)
    }
  }))

  // ESBuild
  rollupConfig.plugins.push(esbuild({
    sourceMap: true
  }))

  // Dynamic Require Support
  rollupConfig.plugins.push(dynamicRequire({
    dir: resolve(nitroContext._nuxt.buildDir, 'dist/server'),
    inline: nitroContext.node === false || nitroContext.inlineDynamicImports,
    globbyOptions: {
      ignore: [
        'server.js'
      ]
    }
  }))

  // Static
  if (nitroContext.serveStatic) {
    rollupConfig.plugins.push(dirnames())
    rollupConfig.plugins.push(staticAssets(nitroContext))
  }

  // Middleware
  rollupConfig.plugins.push(middleware(() => {
    const _middleware = [
      ...nitroContext.scannedMiddleware,
      ...nitroContext.middleware
    ]
    if (nitroContext.serveStatic) {
      _middleware.unshift({ route: '/', handle: '~runtime/server/static' })
    }
    return _middleware
  }))

  // Polyfill
  rollupConfig.plugins.push(virtual({
    '~polyfill': env.polyfill.map(p => `import '${p}';`).join('\n')
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  const renderer = nitroContext.renderer || (nitroContext._nuxt.majorVersion === 3 ? 'vue3' : 'vue2')
  const vue2ServerRenderer = 'vue-server-renderer/' + (nitroContext._nuxt.dev ? 'build.dev.js' : 'build.prod.js')
  rollupConfig.plugins.push(alias({
    entries: {
      '~runtime': nitroContext._internal.runtimeDir,
      '~renderer': require.resolve(resolve(nitroContext._internal.runtimeDir, 'app', renderer)),
      '~vueServerRenderer': vue2ServerRenderer,
      '~build': nitroContext._nuxt.buildDir,
      ...env.alias
    }
  }))

  const moduleDirectories = [
    resolve(nitroContext._nuxt.rootDir, 'node_modules'),
    resolve(MODULE_DIR, 'node_modules'),
    resolve(MODULE_DIR, '../node_modules'),
    'node_modules'
  ]

  // Externals Plugin
  if (nitroContext.externals) {
    rollupConfig.plugins.push(externals(defu(nitroContext.externals as any, {
      outDir: nitroContext.output.serverDir,
      moduleDirectories,
      ignore: [
        nitroContext._internal.runtimeDir,
        ...(nitroContext._nuxt.dev ? [] : [nitroContext._nuxt.buildDir]),
        ...nitroContext.middleware.map(m => m.handle),
        nitroContext._nuxt.rootDir,
        nitroContext._nuxt.serverDir
      ],
      traceOptions: {
        base: nitroContext._nuxt.rootDir
      }
    })))
  }

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  rollupConfig.plugins.push(nodeResolve({
    extensions,
    preferBuiltins: true,
    rootDir: nitroContext._nuxt.rootDir,
    moduleDirectories,
    mainFields: ['main'] // Force resolve CJS (@vue/runtime-core ssrUtils)
  }))

  // Automatically mock unresolved externals
  rollupConfig.plugins.push(autoMock())

  // https://github.com/rollup/plugins/tree/master/packages/commonjs
  rollupConfig.plugins.push(commonjs({
    extensions: extensions.filter(ext => ext !== '.json')
  }))

  // https://github.com/rollup/plugins/tree/master/packages/json
  rollupConfig.plugins.push(json())

  // https://github.com/rollup/plugins/tree/master/packages/inject
  rollupConfig.plugins.push(inject(env.inject))

  if (nitroContext.analyze) {
    // https://github.com/doesdev/rollup-plugin-analyzer
    rollupConfig.plugins.push(analyze())
  }

  // https://github.com/TrySound/rollup-plugin-terser
  // https://github.com/terser/terser#minify-nitroContext
  if (nitroContext.minify) {
    rollupConfig.plugins.push(terser({
      mangle: {
        keep_fnames: true,
        keep_classnames: true
      },
      format: {
        comments: false
      }
    }))
  }

  return rollupConfig
}
