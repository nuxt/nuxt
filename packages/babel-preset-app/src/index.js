const coreJsMeta = {
  2: {
    prefixes: {
      es6: 'es6',
      es7: 'es7'
    },
    builtIns: '@babel/preset-env/data/built-ins.json.js'
  },
  3: {
    prefixes: {
      es6: 'es',
      es7: 'es'
    },
    builtIns: 'core-js-compat/data'
  }
}

function getDefaultPolyfills (corejs) {
  const { prefixes: { es6, es7 } } = coreJsMeta[corejs.version]
  return [
    // Promise polyfill alone doesn't work in IE,
    // Needs this as well. see: #1642
    `${es6}.array.iterator`,
    // This is required for webpack code splitting, vuex etc.
    `${es6}.promise`,
    // this is needed for object rest spread support in templates
    // as vue-template-es2015-compiler 1.8+ compiles it to Object.assign() calls.
    `${es6}.object.assign`,
    // #2012 es7.promise replaces native Promise in FF and causes missing finally
    `${es7}.promise.finally`
  ]
}

function getPolyfills (targets, includes, { ignoreBrowserslistConfig, configPath, corejs }) {
  const { isPluginRequired } = require('@babel/preset-env')
  const builtInsList = require(coreJsMeta[corejs.version].builtIns)
  const getTargets = require('@babel/preset-env/lib/targets-parser').default
  const builtInTargets = getTargets(targets, {
    ignoreBrowserslistConfig,
    configPath
  })

  return includes.filter(item => isPluginRequired(builtInTargets, builtInsList[item]))
}

module.exports = (api, options = {}) => {
  const presets = []
  const plugins = []

  const envName = api.env()

  const {
    polyfills: userPolyfills,
    loose = false,
    debug = false,
    useBuiltIns = 'usage',
    modules = false,
    spec,
    ignoreBrowserslistConfig = envName === 'modern',
    configPath,
    include,
    exclude,
    shippedProposals,
    forceAllTransforms,
    decoratorsBeforeExport,
    decoratorsLegacy,
    absoluteRuntime
  } = options

  let { corejs = { version: 2 } } = options

  if (typeof corejs !== 'object') {
    corejs = { version: Number(corejs) }
  }

  const defaultTargets = {
    server: { node: 'current' },
    client: { ie: 9 },
    modern: { esmodules: true }
  }

  let { targets = defaultTargets[envName] } = options

  // modern mode can only be { esmodules: true }
  if (envName === 'modern') {
    targets = defaultTargets.modern
  }

  const polyfills = []

  if (envName === 'client' && useBuiltIns === 'usage') {
    polyfills.push(
      ...getPolyfills(
        targets,
        userPolyfills || getDefaultPolyfills(corejs),
        {
          ignoreBrowserslistConfig,
          configPath,
          corejs
        }
      )
    )
    plugins.push([require('./polyfills-plugin'), { polyfills }])
  }

  // Pass options along to babel-preset-env
  presets.push([
    require('@babel/preset-env'), {
      spec,
      loose,
      debug,
      modules,
      targets,
      useBuiltIns,
      corejs,
      ignoreBrowserslistConfig,
      configPath,
      include,
      exclude: polyfills.concat(exclude || []),
      shippedProposals,
      forceAllTransforms
    }
  ])

  // JSX
  if (options.jsx !== false) {
    presets.push([require('@vue/babel-preset-jsx'), Object.assign({}, options.jsx)])
  }

  plugins.push(
    [require('@babel/plugin-proposal-decorators'), {
      decoratorsBeforeExport,
      legacy: decoratorsLegacy !== false
    }],
    [require('@babel/plugin-proposal-class-properties'), { loose: true }]
  )

  // Transform runtime, but only for helpers
  plugins.push([require('@babel/plugin-transform-runtime'), {
    regenerator: useBuiltIns !== 'usage',
    corejs: false,
    helpers: useBuiltIns === 'usage',
    useESModules: envName !== 'server',
    absoluteRuntime
  }])

  return {
    presets,
    plugins
  }
}
