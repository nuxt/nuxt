import { relative } from 'path'
import consola from 'consola'

export default {
  entry: require.resolve('./entry'),
  hooks: {
    'rollup:done' ({ rollupConfig }) {
      consola.info(`Usage: \`node ${relative(process.cwd(), rollupConfig.output.file)} [route]\``)
    }
  }
}
