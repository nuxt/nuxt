import consola from 'consola'

export default {
  entry: require.resolve('./entry'),
  hooks: {
    'rollup:done' (_ctx) {
      consola.info('Run `vercel deploy` to deploy!')
    }
  }
}
