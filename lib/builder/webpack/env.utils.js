const {each, mapValues} = require('lodash')

exports.getEnvVariables = function (options, VUE_ENV) {
  const envVariables = Object.assign({
    NODE_ENV: options.dev ? 'development' : 'production',
    VUE_ENV
  }, flattenNested(options.env))

  return stringifyValuesForWebpack(envVariables)
}

function flattenNested(src) {
  let flatten = {}
  fillEnv(src, flatten)

  return flatten
}

function fillEnv(src, dest, prefix = null) {
  each(src, (value, key) => {
    const prefixedKey = prefix ? prefix + '[' + key + ']' : key

    if (typeof value === 'object') {
      fillEnv(value, dest, prefixedKey)
    }
    dest[prefixedKey] = value
  })
}

function stringifyValuesForWebpack(envVariables) {
  return mapValues(envVariables, value => {
    return ['boolean', 'number'].indexOf(typeof value) !== -1
      ? value
      : JSON.stringify(value)
  })
}
