function isRollupPluginBabel (caller) {
  return caller && caller.name === 'rollup-plugin-babel'
}

function presetEnv (nodeVersion) {
  return [ '@babel/env', { targets: { node: nodeVersion } } ]
}

module.exports = function (api) {
  if (api.env('test') || api.caller(isRollupPluginBabel)) {
    return {
      presets: [
        presetEnv('8.9.0'),
        '@babel/typescript'
      ],
      exclude: 'node_modules/**'
    }
  }

  return {}
}
