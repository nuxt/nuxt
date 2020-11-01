export default {
  entry: require.resolve('./entry'),
  node: false,
  hooks: {
    'rollup:config' ({ rollupConfig }) {
      rollupConfig.output.intro += 'const global = {}; const exports = {}; const module = { exports }; const require = function() {};'
      rollupConfig.output.format = 'iife'
    }
  }
}
