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

import { SigmaContext } from '../context'
import { resolvePath, MODULE_DIR } from '../utils'

import { dynamicRequire } from './plugins/dynamic-require'
import { externals } from './plugins/externals'
import { timing } from './plugins/timing'
import { autoMock } from './plugins/automock'
import { staticAssets, dirnames } from './plugins/static'
import { middleware } from './plugins/middleware'
import { esbuild } from './plugins/esbuild'

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (sigmaContext: SigmaContext) => {
  const extensions: string[] = ['.ts', '.mjs', '.js', '.json', '.node']

  const nodePreset = sigmaContext.node === false ? un.nodeless : un.node

  const builtinPreset: Preset = {
    alias: {
      // General
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

  const env = un.env(nodePreset, builtinPreset, sigmaContext.env)

  delete env.alias['node-fetch'] // FIX ME

  if (sigmaContext.sourceMap) {
    env.polyfill.push('source-map-support/register')
  }

  const buildServerDir = join(sigmaContext._nuxt.buildDir, 'dist/server')
  const runtimeAppDir = join(sigmaContext._internal.runtimeDir, 'app')

  const rollupConfig: RollupConfig = {
    input: resolvePath(sigmaContext, sigmaContext.entry),
    output: {
      dir: sigmaContext.output.serverDir,
      entryFileNames: 'index.js',
      chunkFileNames (chunkInfo) {
        let prefix = ''
        const modules = Object.keys(chunkInfo.modules)
        const lastModule = modules[modules.length - 1]
        if (lastModule.startsWith(buildServerDir)) {
          prefix = join('app', relative(buildServerDir, dirname(lastModule)))
        } else if (lastModule.startsWith(runtimeAppDir)) {
          prefix = 'app'
        } else if (lastModule.startsWith(sigmaContext._nuxt.buildDir)) {
          prefix = 'nuxt'
        } else if (lastModule.startsWith(sigmaContext._internal.runtimeDir)) {
          prefix = 'sigma'
        } else if (!prefix && sigmaContext.middleware.find(m => lastModule.startsWith(m.handle))) {
          prefix = 'middleware'
        }
        return join('chunks', prefix, '[name].js')
      },
      inlineDynamicImports: sigmaContext.inlineChunks,
      format: 'cjs',
      exports: 'auto',
      intro: '',
      outro: '',
      preferConst: true,
      sourcemap: sigmaContext.sourceMap,
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

  if (sigmaContext.timing) {
    rollupConfig.plugins.push(timing())
  }

  // https://github.com/rollup/plugins/tree/master/packages/replace
  rollupConfig.plugins.push(replace({
    values: {
      'process.env.NODE_ENV': sigmaContext._nuxt.dev ? '"development"' : '"production"',
      'typeof window': '"undefined"',
      'process.env.ROUTER_BASE': JSON.stringify(sigmaContext._nuxt.routerBase),
      'process.env.PUBLIC_PATH': JSON.stringify(sigmaContext._nuxt.publicPath),
      'process.env.NUXT_STATIC_BASE': JSON.stringify(sigmaContext._nuxt.staticAssets.base),
      'process.env.NUXT_STATIC_VERSION': JSON.stringify(sigmaContext._nuxt.staticAssets.version),
      'process.env.NUXT_FULL_STATIC': sigmaContext._nuxt.fullStatic as unknown as string,
      'process.env.SIGMA_PRESET': JSON.stringify(sigmaContext.preset),
      'process.env.RUNTIME_CONFIG': JSON.stringify(sigmaContext._nuxt.runtimeConfig),
      'process.env.DEBUG': JSON.stringify(sigmaContext._nuxt.dev)
    }
  }))

  // ESBuild
  rollupConfig.plugins.push(esbuild({
    sourceMap: true
  }))

  // Dynamic Require Support
  rollupConfig.plugins.push(dynamicRequire({
    dir: resolve(sigmaContext._nuxt.buildDir, 'dist/server'),
    inline: sigmaContext.node === false || sigmaContext.inlineChunks,
    globbyOptions: {
      ignore: [
        'server.js'
      ]
    }
  }))

  // Static
  if (sigmaContext.serveStatic) {
    rollupConfig.plugins.push(dirnames())
    rollupConfig.plugins.push(staticAssets(sigmaContext))
  }

  // Middleware
  const _middleware = [...sigmaContext.middleware]
  if (sigmaContext.serveStatic) {
    _middleware.unshift({ route: '/', handle: '~runtime/server/static' })
  }
  rollupConfig.plugins.push(middleware(_middleware))

  // Polyfill
  rollupConfig.plugins.push(virtual({
    '~polyfill': env.polyfill.map(p => `import '${p}';`).join('\n')
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  const renderer = sigmaContext.renderer || 'vue2'
  const vueServerRenderer = 'vue-server-renderer/' + (sigmaContext._nuxt.dev ? 'build.dev.js' : 'build.prod.js')
  rollupConfig.plugins.push(alias({
    entries: {
      '~runtime': sigmaContext._internal.runtimeDir,
      '~renderer': require.resolve(resolve(sigmaContext._internal.runtimeDir, 'app', renderer)),
      '~vueServerRenderer': vueServerRenderer,
      '~build': sigmaContext._nuxt.buildDir,
      ...env.alias
    }
  }))

  const moduleDirectories = [
    resolve(sigmaContext._nuxt.rootDir, 'node_modules'),
    resolve(MODULE_DIR, 'node_modules'),
    resolve(MODULE_DIR, '../node_modules'),
    'node_modules'
  ]

  // Externals Plugin
  if (sigmaContext.externals) {
    rollupConfig.plugins.push(externals(defu(sigmaContext.externals as any, {
      outDir: sigmaContext.output.serverDir,
      moduleDirectories,
      ignore: [
        sigmaContext._internal.runtimeDir,
        ...(sigmaContext._nuxt.dev ? [] : [sigmaContext._nuxt.buildDir]),
        ...sigmaContext.middleware.map(m => m.handle)
      ],
      traceOptions: {
        base: sigmaContext._nuxt.rootDir
      }
    })))
  }

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  rollupConfig.plugins.push(nodeResolve({
    extensions,
    preferBuiltins: true,
    rootDir: sigmaContext._nuxt.rootDir,
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

  if (sigmaContext.analyze) {
    // https://github.com/doesdev/rollup-plugin-analyzer
    rollupConfig.plugins.push(analyze())
  }

  // https://github.com/TrySound/rollup-plugin-terser
  // https://github.com/terser/terser#minify-sigmaContext
  if (sigmaContext.minify) {
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
