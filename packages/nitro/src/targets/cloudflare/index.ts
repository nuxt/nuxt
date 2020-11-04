export default {
  entry: require.resolve('./entry'),
  node: false,
  hooks: {
    'rollup:before' ({ rollupConfig }) {
      rollupConfig.output.intro =
        'const global = {}; const exports = {}; const module = { exports }; const process = { env: {}, hrtime: () => [0,0]};' +
      rollupConfig.output.intro
      rollupConfig.output.format = 'iife'
    }
  }
}
