import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import { dirname, join, relative, resolve } from 'pathe'
import type { InputOptions, OutputOptions } from 'rollup'
import defu from 'defu'
import { terser } from 'rollup-plugin-terser'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import alias from '@rollup/plugin-alias'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import virtual from '@rollup/plugin-virtual'
import wasmPlugin from '@rollup/plugin-wasm'
import inject from '@rollup/plugin-inject'
import { visualizer } from 'rollup-plugin-visualizer'
import * as unenv from 'unenv'
import devalue from '@nuxt/devalue'

import type { Preset } from 'unenv'
import { sanitizeFilePath } from 'mlly'
import { NitroContext } from '../context'
import { resolvePath } from '../utils'
import { pkgDir } from '../dirs'

import { dynamicRequire } from './plugins/dynamic-require'
import { externals, NodeExternalsOptions } from './plugins/externals'
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
      '@vue/compiler-ssr': 'unenv/runtime/mock/proxy',
      ...nitroContext.alias
    }
  }

  const env = unenv.env(nodePreset, builtinPreset, nitroContext.env)

  if (nitroContext.sourceMap) {
    env.polyfill.push('source-map-support/register.js')
  }

  // TODO: #590
  const _require = createRequire(import.meta.url)
  if (nitroContext._nuxt.majorVersion === 3) {
    env.alias['vue/server-renderer'] = 'vue/server-renderer'
    env.alias['vue/compiler-sfc'] = 'vue/compiler-sfc'
    env.alias.vue = _require.resolve(`vue/dist/vue.cjs${nitroContext._nuxt.dev ? '' : '.prod'}.js`)
  }

  const buildServerDir = join(nitroContext._nuxt.buildDir, 'dist/server')
  const runtimeAppDir = join(nitroContext._internal.runtimeDir, 'app')

  const rollupConfig: RollupConfig = {
    input: resolvePath(nitroContext, nitroContext.entry),
    output: {
      dir: nitroContext.output.serverDir,
      entryFileNames: 'index.mjs',
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
        } else if (nitroContext.middleware.find(m => lastModule.startsWith(m.handle as string))) {
          prefix = 'middleware'
        } else if (lastModule.includes('assets')) {
          prefix = 'assets'
        }
        return join('chunks', prefix, '[name].mjs')
      },
      inlineDynamicImports: nitroContext.inlineDynamicImports,
      format: 'esm',
      exports: 'auto',
      intro: '',
      outro: '',
      preferConst: true,
      sanitizeFileName: sanitizeFilePath,
      sourcemap: !!nitroContext.sourceMap,
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
    },
    treeshake: {
      moduleSideEffects (id) {
        return nitroContext.moduleSideEffects.some(match => id.startsWith(match))
      }
    }
  }

  if (nitroContext.timing) {
    rollupConfig.plugins.push(timing())
  }

  // Raw asset loader
  rollupConfig.plugins.push(raw())

  // WASM import support
  if (nitroContext.experiments.wasm) {
    rollupConfig.plugins.push(wasmPlugin())
  }

  // https://github.com/rollup/plugins/tree/master/packages/replace
  rollupConfig.plugins.push(replace({
    sourceMap: !!nitroContext.sourceMap,
    preventAssignment: true,
    values: {
      'process.env.NODE_ENV': nitroContext._nuxt.dev ? '"development"' : '"production"',
      'typeof window': '"undefined"',
      'global.': 'globalThis.',
      'process.server': 'true',
      'process.client': 'false',
      'process.env.NUXT_NO_SSR': JSON.stringify(!nitroContext._nuxt.ssr),
      'process.env.ROUTER_BASE': JSON.stringify(nitroContext._nuxt.routerBase),
      'process.env.PUBLIC_PATH': JSON.stringify(nitroContext._nuxt.publicPath),
      'process.env.NUXT_STATIC_BASE': JSON.stringify(nitroContext._nuxt.staticAssets.base),
      'process.env.NUXT_STATIC_VERSION': JSON.stringify(nitroContext._nuxt.staticAssets.version),
      'process.env.NUXT_FULL_STATIC': nitroContext._nuxt.fullStatic as unknown as string,
      'process.env.NITRO_PRESET': JSON.stringify(nitroContext.preset),
      'process.env.RUNTIME_CONFIG': devalue(nitroContext._nuxt.runtimeConfig),
      'process.env.DEBUG': JSON.stringify(nitroContext._nuxt.dev)
    }
  }))

  // ESBuild
  rollupConfig.plugins.push(esbuild({
    target: 'es2019',
    sourceMap: !!nitroContext.sourceMap,
    ...nitroContext.esbuild?.options
  }))

  // Dynamic Require Support
  rollupConfig.plugins.push(dynamicRequire({
    dir: resolve(nitroContext._nuxt.buildDir, 'dist/server'),
    inline: nitroContext.node === false || nitroContext.inlineDynamicImports,
    ignore: [
      'client.manifest.mjs',
      'server.js',
      'server.cjs',
      'server.mjs',
      'server.manifest.mjs'
    ]
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
    '#polyfill': env.polyfill.map(p => `import '${p}';`).join('\n')
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  const renderer = nitroContext.renderer || (nitroContext._nuxt.majorVersion === 3 ? 'vue3' : 'vue2')
  const vue2ServerRenderer = 'vue-server-renderer/' + (nitroContext._nuxt.dev ? 'build.dev.js' : 'build.prod.js')
  rollupConfig.plugins.push(alias({
    entries: {
      '#nitro': nitroContext._internal.runtimeDir,
      '#nitro-renderer': resolve(nitroContext._internal.runtimeDir, 'app', renderer),
      '#config': resolve(nitroContext._internal.runtimeDir, 'app/config'),
      '#nitro-vue-renderer': vue2ServerRenderer,
      // Only file and data URLs are supported by the default ESM loader on Windows (#427)
      '#build': nitroContext._nuxt.dev && process.platform === 'win32'
        ? pathToFileURL(nitroContext._nuxt.buildDir).href
        : nitroContext._nuxt.buildDir,
      '~': nitroContext._nuxt.srcDir,
      '@/': nitroContext._nuxt.srcDir,
      '~~': nitroContext._nuxt.rootDir,
      '@@/': nitroContext._nuxt.rootDir,
      ...env.alias
    }
  }))

  const moduleDirectories = [
    resolve(nitroContext._nuxt.rootDir, 'node_modules'),
    ...nitroContext._nuxt.modulesDir,
    resolve(pkgDir, '../node_modules'),
    'node_modules'
  ]

  // Externals Plugin
  if (nitroContext.externals) {
    rollupConfig.plugins.push(externals(defu(nitroContext.externals as NodeExternalsOptions, {
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
        ...nitroContext.middleware.map(m => m.handle).filter(i => typeof i === 'string') as string[],
        ...(nitroContext._nuxt.dev ? [] : ['vue', '@vue/', '@nuxt/'])
      ],
      traceOptions: {
        base: '/',
        processCwd: nitroContext._nuxt.rootDir,
        exportsOnly: true
      }
    })))
  }

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  rollupConfig.plugins.push(nodeResolve({
    extensions,
    preferBuiltins: true,
    rootDir: nitroContext._nuxt.rootDir,
    moduleDirectories,
    // 'module' is intentionally not supported because of externals
    mainFields: ['main'],
    exportConditions: [
      'default',
      'module',
      'node',
      'import'
    ]
  }))

  // Automatically mock unresolved externals
  // rollupConfig.plugins.push(autoMock())

  // https://github.com/rollup/plugins/tree/master/packages/commonjs
  rollupConfig.plugins.push(commonjs({
    sourceMap: !!nitroContext.sourceMap,
    esmExternals: id => !id.startsWith('unenv/'),
    requireReturnsDefault: 'auto'
  }))

  // https://github.com/rollup/plugins/tree/master/packages/json
  rollupConfig.plugins.push(json())

  // https://github.com/rollup/plugins/tree/master/packages/inject
  rollupConfig.plugins.push(inject({
    // TODO: https://github.com/rollup/plugins/pull/1066
    // @ts-ignore
    sourceMap: !!nitroContext.sourceMap,
    ...env.inject
  }))

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

  if (nitroContext.analyze) {
    // https://github.com/btd/rollup-plugin-visualizer
    rollupConfig.plugins.push(visualizer({
      ...nitroContext.analyze,
      filename: nitroContext.analyze.filename.replace('{name}', 'nitro'),
      title: 'Nitro Server bundle stats'
    }))
  }

  return rollupConfig
}
