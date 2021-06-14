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
import * as unenv from 'unenv'

import type { Preset } from 'unenv'
import { NitroContext } from '../context'
import { resolvePath, MODULE_DIR } from '../utils'

import { dynamicRequire } from './plugins/dynamic-require'
import { externals } from './plugins/externals'
import { timing } from './plugins/timing'
// import { autoMock } from './plugins/automock'
import { staticAssets, dirnames } from './plugins/static'
import { assets } from './plugins/assets'
import { middleware } from './plugins/middleware'
import { esbuild } from './plugins/esbuild'
import { raw } from './plugins/raw'
import { storage } from './plugins/storage'

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (nitroContext: NitroContext) => {
  const extensions: string[] = ['.ts', '.mjs', '.js', '.json', '.node']

  const nodePreset = nitroContext.node === false ? unenv.nodeless : unenv.node

  const builtinPreset: Preset = {
    alias: {
      // General
      debug: 'unenv/runtime/npm/debug',
      consola: 'unenv/runtime/npm/consola',
      // Vue 2
      encoding: 'unenv/runtime/mock/proxy',
      he: 'unenv/runtime/mock/proxy',
      resolve: 'unenv/runtime/mock/proxy',
      'source-map': 'unenv/runtime/mock/proxy',
      'lodash.template': 'unenv/runtime/mock/proxy',
      'serialize-javascript': 'unenv/runtime/mock/proxy',
      // Vue 3
      'estree-walker': 'unenv/runtime/mock/proxy',
      '@babel/parser': 'unenv/runtime/mock/proxy',
      '@vue/compiler-core': 'unenv/runtime/mock/proxy',
      '@vue/compiler-dom': 'unenv/runtime/mock/proxy',
      '@vue/compiler-ssr': 'unenv/runtime/mock/proxy'
    }
  }

  const env = unenv.env(nodePreset, builtinPreset, nitroContext.env)

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
        } else if (!prefix && nitroContext.middleware.find(m => lastModule.startsWith(m.handle as string))) {
          prefix = 'middleware'
        } else if (lastModule.includes('assets')) {
          prefix = 'assets'
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
    // https://github.com/rollup/rollup/pull/4021#issuecomment-809985618
    // https://github.com/nuxt/framework/issues/160
    makeAbsoluteExternalsRelative: false,
    plugins: [],
    onwarn (warning, rollupWarn) {
      if (
        !['CIRCULAR_DEPENDENCY', 'EVAL'].includes(warning.code) &&
       !warning.message.includes('Unsupported source map comment')
      ) {
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
      'global.': 'globalThis.',
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
    target: 'es2019',
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

  // Assets
  rollupConfig.plugins.push(assets(nitroContext.assets))

  // Static
  // TODO: use assets plugin
  if (nitroContext.serveStatic) {
    rollupConfig.plugins.push(dirnames())
    rollupConfig.plugins.push(staticAssets(nitroContext))
  }

  // Storage
  rollupConfig.plugins.push(storage(nitroContext.storage))

  // Middleware
  rollupConfig.plugins.push(middleware(() => {
    const _middleware = [
      ...nitroContext.scannedMiddleware,
      ...nitroContext.middleware
    ]
    if (nitroContext.serveStatic) {
      _middleware.unshift({ route: '/', handle: '#nitro/server/static' })
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
      '#nitro': nitroContext._internal.runtimeDir,
      '#nitro-renderer': require.resolve(resolve(nitroContext._internal.runtimeDir, 'app', renderer)),
      '#config': require.resolve(resolve(nitroContext._internal.runtimeDir, 'app/config')),
      '#nitro-vue-renderer': vue2ServerRenderer,
      '#build': nitroContext._nuxt.buildDir,
      '~': nitroContext._nuxt.srcDir,
      '@/': nitroContext._nuxt.srcDir,
      '~~': nitroContext._nuxt.rootDir,
      '@@/': nitroContext._nuxt.rootDir,
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
      external: [
        ...(nitroContext._nuxt.dev ? [nitroContext._nuxt.buildDir] : [])
      ],
      inline: [
        '#',
        '~',
        '@/',
        '~~',
        '@@/',
        'virtual:',
        nitroContext._internal.runtimeDir,
        nitroContext._nuxt.srcDir,
        nitroContext._nuxt.rootDir,
        nitroContext._nuxt.serverDir,
        ...nitroContext.middleware.map(m => m.handle),
        ...(nitroContext._nuxt.dev ? [] : ['vue', '@vue/', '@nuxt/'])
      ],
      traceOptions: {
        base: '/',
        processCwd: nitroContext._nuxt.rootDir
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
  // rollupConfig.plugins.push(autoMock())

  // https://github.com/rollup/plugins/tree/master/packages/commonjs
  rollupConfig.plugins.push(commonjs({
    requireReturnsDefault: 'auto'
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
