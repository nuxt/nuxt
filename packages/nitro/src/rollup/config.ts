import Module from 'module'
import { dirname, join, resolve } from 'path'
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

import hasha from 'hasha'
import { SLSOptions } from '../config'
import { resolvePath, MODULE_DIR } from '../utils'
import { dynamicRequire } from './dynamic-require'
import { externals } from './externals'

const mapArrToVal = (val, arr) => arr.reduce((p, c) => ({ ...p, [c]: val }), {})

export type RollupConfig = InputOptions & { output: OutputOptions }

export const getRollupConfig = (options: SLSOptions) => {
  const extensions: string[] = ['.ts', '.mjs', '.js', '.json', '.node']

  const external: InputOptions['external'] = []

  const injects:{ [key: string]: string| string[] } = {}

  const aliases: { [key: string]: string } = {}

  Object.assign(aliases, mapArrToVal('~mocks/generic', [
    // @nuxt/devalue
    'consola',
    // vue2
    'encoding',
    'stream',
    'he',
    'resolve',
    'source-map',
    'lodash.template',
    'serialize-javascript',
    // vue3
    '@babel/parser',
    '@vue/compiler-core',
    '@vue/compiler-dom',
    '@vue/compiler-ssr'
  ]))

  // Uses eval
  aliases.depd = '~mocks/custom/depd'

  if (options.node === false) {
    // Globals
    // injects.Buffer = ['buffer', 'Buffer'] <-- TODO: Make it opt-in
    injects.process = '~mocks/node/process'

    // Aliases
    Object.assign(aliases, {
      // Node
      ...mapArrToVal('~mocks/generic', Module.builtinModules),
      http: '~mocks/node/http',
      fs: '~mocks/node/fs',
      process: '~mocks/node/process',
      'node-process': require.resolve('process/browser.js'),
      // buffer: require.resolve('buffer/index.js'),
      util: require.resolve('util/util.js'),
      events: require.resolve('events/events.js'),
      inherits: require.resolve('inherits/inherits_browser.js'),

      // Custom
      'node-fetch': '~mocks/custom/node-fetch',
      etag: '~mocks/generic/noop',

      // Express
      ...mapArrToVal('~mocks/generic', [
        'serve-static',
        'iconv-lite'
      ]),

      // Mime
      'mime-db': '~mocks/custom/mime-db',
      'mime/lite': require.resolve('mime/lite'),
      mime: '~mocks/custom/mime'
    })
  } else {
    external.push(...Module.builtinModules)
  }

  const chunksDirName = join(dirname(options.outName), 'chunks')

  const rollupConfig: RollupConfig = {
    input: resolvePath(options, options.entry),
    output: {
      dir: options.targetDir,
      entryFileNames: options.outName,
      chunkFileNames: join(chunksDirName, '[name].js'),
      inlineDynamicImports: options.inlineChunks,
      format: 'cjs',
      exports: 'auto',
      intro: '',
      outro: '',
      preferConst: true
    },
    external,
    plugins: []
  }

  if (options.logStartup) {
    rollupConfig.output.intro += 'global._startTime = global.process.hrtime();'
    // eslint-disable-next-line no-template-curly-in-string
    rollupConfig.output.outro += 'global._endTime = global.process.hrtime(global._startTime); global._coldstart = ((global._endTime[0] * 1e9) + global._endTime[1]) / 1e6; console.log(`λ Cold start took: ${global._coldstart}ms (${typeof __filename !== "undefined" ? __filename.replace(process.cwd(), "") : "<entry>"})`);'
  }

  // https://github.com/rollup/plugins/tree/master/packages/replace
  rollupConfig.plugins.push(replace({
    values: {
      'process.env.NODE_ENV': '"production"',
      'typeof window': '"undefined"',
      'process.env.ROUTER_BASE': JSON.stringify(options.routerBase),
      'process.env.PUBLIC_PATH': JSON.stringify(options.publicPath),
      'process.env.NUXT_STATIC_BASE': JSON.stringify(options.staticAssets.base),
      'process.env.NUXT_STATIC_VERSION': JSON.stringify(options.staticAssets.version),
      // @ts-ignore
      'process.env.NUXT_FULL_STATIC': options.fullStatic
    }
  }))

  // Dynamic Require Support
  rollupConfig.plugins.push(dynamicRequire({
    dir: resolve(options.buildDir, 'dist/server'),
    inline: options.node === false || options.inlineChunks,
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
      ${options.serverMiddleware.filter(m => !m.lazy).map(m => `import ${getImportId(m.handle)} from '${m.handle}';`).join('\n')}

      ${options.serverMiddleware.filter(m => m.lazy).map(m => `const ${getImportId(m.handle)} = () => import('${m.handle}');`).join('\n')}

      export default [
        ${options.serverMiddleware.map(m => `{ route: '${m.route}', handle: ${getImportId(m.handle)}, lazy: ${m.lazy || false} }`).join(',\n')}
      ];
    `
  }))

  // https://github.com/rollup/plugins/tree/master/packages/alias
  const renderer = options.renderer || 'vue2'
  rollupConfig.plugins.push(alias({
    entries: {
      '~runtime': options.runtimeDir,
      '~mocks': resolve(options.runtimeDir, 'mocks'),
      '~renderer': require.resolve(resolve(options.runtimeDir, 'ssr', renderer)),
      '~build': options.buildDir,
      '~mock': require.resolve(resolve(options.runtimeDir, 'mocks/generic')),
      ...aliases
    }
  }))

  // External Plugin
  if (options.externals) {
    rollupConfig.plugins.push(externals({
      relativeTo: options.targetDir,
      include: [
        options.runtimeDir,
        ...options.serverMiddleware.map(m => m.handle)
      ]
    }))
  }

  // https://github.com/rollup/plugins/tree/master/packages/node-resolve
  rollupConfig.plugins.push(nodeResolve({
    extensions,
    preferBuiltins: true,
    rootDir: options.rootDir,
    // https://www.npmjs.com/package/resolve
    customResolveOptions: {
      basedir: options.rootDir,
      paths: [
        resolve(options.rootDir, 'node_modukes'),
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
  rollupConfig.plugins.push(inject(injects))

  if (options.analyze) {
    // https://github.com/doesdev/rollup-plugin-analyzer
    rollupConfig.plugins.push(analyze())
  }

  if (options.minify !== false) {
    rollupConfig.plugins.push(terser())
  }

  return rollupConfig
}
