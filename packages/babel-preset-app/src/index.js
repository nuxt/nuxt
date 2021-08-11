const coreJsMeta = {
  2: {
    prefixes: {
      es6: 'es6',
      es7: 'es7'
    },
    builtIns: require.resolve('@babel/compat-data/corejs2-built-ins')
  },
  3: {
    prefixes: {
      es6: 'es',
      es7: 'es'
    },
    builtIns: require.resolve('core-js-compat/data')
  }
}

function getMajorVersion (version) {
  if (typeof version === 'number') {
    return Math.floor(version)
  } else {
    return Number(version.split('.')[0])
  }
}

function getDefaultPolyfills (corejs) {
  const { prefixes: { es6, es7 } } = coreJsMeta[getMajorVersion(corejs.version)]
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
  const { default: getTargets, isRequired } = require('@babel/helper-compilation-targets')
  const builtInsList = require(coreJsMeta[getMajorVersion(corejs.version)].builtIns)
  const builtInTargets = getTargets(targets, {
    ignoreBrowserslistConfig,
    configPath
  })

  return includes.filter(item => isRequired(
    'nuxt-polyfills',
    builtInTargets,
    {
      compatData: { 'nuxt-polyfills': builtInsList[item] }
    }
  ))
}

module.exports = (api, options = {}) => {
  const presets = []
  const plugins = []

  const envName = api.env()

  const {
    bugfixes,
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

  if (corejs.proposals === undefined) {
    corejs.proposals = true
  }

  const defaultTargets = {
    server: { node: 'current' },
    client: { ie: 9 },
    modern: { esmodules: true }
  }

  const { targets = defaultTargets[envName] } = options

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
      bugfixes,
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
      exclude: [
        ...exclude || [],
        ...polyfills,
        // Although preset-env includes class-properties
        // but webpack 4 doesn't support the syntax when target supports and babel transpilation is skipped
        // https://github.com/webpack/webpack/issues/9708
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-proposal-private-methods',
        '@babel/plugin-proposal-private-property-in-object'
      ],
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
    // class-properties and private-methods need same loose value
    [require('@babel/plugin-proposal-class-properties'), { loose: true }],
    [require('@babel/plugin-proposal-private-methods'), { loose: true }],
    [require('@babel/plugin-proposal-private-property-in-object'), { loose: true }]
  )

  // Transform runtime, but only for helpers
  plugins.push([require('@babel/plugin-transform-runtime'), {
    regenerator: useBuiltIns !== 'usage',
    corejs: false,
    helpers: useBuiltIns === 'usage',
    useESModules: envName !== 'server',
    absoluteRuntime
  }])

  // https://github.com/nuxt/nuxt.js/issues/7722
  if (envName === 'server') {
    plugins.push(require('@babel/plugin-proposal-optional-chaining'))
    plugins.push(require('@babel/plugin-proposal-nullish-coalescing-operator'))
  }

  return {
    sourceType: 'unambiguous',
    presets,
    plugins
  }
}
