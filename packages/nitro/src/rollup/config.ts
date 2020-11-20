import Module from 'module'
import { dirname, join, relative, resolve } from 'upath'
import { InputOptions, OutputOptions } from 'rollup'
import { terser } from 'rollup-plugin-terser'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import alias from '@rollup/plugin-alias'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import virtual from '@rollup/plugin-virtual'
import inject from '@rollup/plugin-inject'
import analyze from 'rollup-plugin-analyzer'
import * as un from '@nuxt/un'

import hasha from 'hasha'
import { SigmaContext } from '../context'
import { resolvePath, MODULE_DIR } from '../utils'

import { dynamicRequire } from './dynamic-require'
import { externals } from './externals'
import { timing } from './timing'

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (sigmaContext: SigmaContext) => {
  const extensions: string[] = ['.ts', '.js', '.json', '.node']

  const external: InputOptions['external'] = []

  const presets = []

  if (sigmaContext.node === false) {
    presets.push(un.nodeless)
  } else {
    presets.push(un.node)
    external.push(...Module.builtinModules)
  }

  const env = un.env(...presets, {
    alias: {
      depd: require.resolve('@nuxt/un/runtime/npm/depd')
    }
  })

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
      preferConst: true
    },
    external,
    plugins: []
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
      // @ts-ignore
      'process.env.NUXT_FULL_STATIC': sigmaContext.fullStatic,
      'process.env.SIGMA_PRESET': JSON.stringify(sigmaContext.preset)
    }
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

  // https://github.com/rollup/plugins/tree/master/packages/replace
  // TODO: better fix for node-fetch issue
  rollupConfig.plugins.push(replace({
    delimiters: ['', ''],
    values: {
      'require(\'encoding\')': '{}'
    }
  }))

  // Provide serverMiddleware
  const getImportId = p => '_' + hasha(p).substr(0, 6)
  rollupConfig.plugins.push(virtual({
    '~serverMiddleware': `
      ${sigmaContext.middleware.filter(m => m.lazy === false).map(m => `import ${getImportId(m.handle)} from '${m.handle}';`).join('\n')}

      ${sigmaContext.middleware.filter(m => m.lazy !== false).map(m => `const ${getImportId(m.handle)} = () => import('${m.handle}');`).join('\n')}

      export default [
        ${sigmaContext.middleware.map(m => `{ route: '${m.route}', handle: ${getImportId(m.handle)}, lazy: ${m.lazy || true}, promisify: ${m.promisify || true} }`).join(',\n')}
      ];
    `
  }))

  // Polyfill
  rollupConfig.plugins.push(virtual({
    '~polyfill': env.polyfill.map(p => `import '${p}';`).join('\n')
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  const renderer = sigmaContext.renderer || 'vue2'
  rollupConfig.plugins.push(alias({
    entries: {
      '~runtime': sigmaContext._internal.runtimeDir,
      '~renderer': require.resolve(resolve(sigmaContext._internal.runtimeDir, 'app', renderer)),
      '~build': sigmaContext._nuxt.buildDir,
      ...env.alias
    }
  }))

  // External Plugin
  if (sigmaContext.externals) {
    rollupConfig.plugins.push(externals({
      relativeTo: sigmaContext.output.serverDir,
      include: [
        sigmaContext._internal.runtimeDir,
        ...sigmaContext.middleware.map(m => m.handle)
      ]
    }))
  }

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  rollupConfig.plugins.push(nodeResolve({
    extensions,
    preferBuiltins: true,
    rootDir: sigmaContext._nuxt.rootDir,
    // https://www.npmjs.com/package/resolve
    customResolveOptions: {
      basedir: sigmaContext._nuxt.rootDir,
      paths: [
        resolve(sigmaContext._nuxt.rootDir, 'node_modules'),
        resolve(MODULE_DIR, 'node_modules')
      ]
    },
    mainFields: ['main'] // Force resolve CJS (@vue/runtime-core ssrUtils)
  }))

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
