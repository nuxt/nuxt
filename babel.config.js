function isBabelLoader(caller) {
  return caller && caller.name === 'babel-loader'
}

module.exports = function (api) {
  if (api.env('test')) {
    const config = {
      presets: [
        ['@babel/env', {
          targets: {
            node: 'current'
          }
        }]
      ],
      plugins: []
    }
    if (!api.caller(isBabelLoader)) {
      config.plugins.push('dynamic-import-node')
    }
    return config
  }
  return {}
}
