function isBabelLoader (caller) {
  return caller && caller.name === 'babel-loader'
}

function presetEnv (nodeVersion) {
  return [ '@babel/env', { targets: { node: nodeVersion } } ]
}

module.exports = function (api) {
  if (api.env('test') && !api.caller(isBabelLoader)) {
    return { presets: [ presetEnv('current') ] }
  }

  return {
    presets: [
      presetEnv('8.9.0'),
      '@babel/typescript'
    ],
    exclude: 'node_modules/**'
  }
}
