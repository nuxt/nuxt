
import consola from 'consola'

export default {
  entry: require.resolve('./entry'),
  hooks: {
    'done' ({ rollupConfig }) {
      consola.info(`Usage: \`node ${rollupConfig.output.file} [route]\``)
    }
  }
}
