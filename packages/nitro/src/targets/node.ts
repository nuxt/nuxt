import { relative } from 'path'
import consola from 'consola'
import { SLSTarget } from '../config'

export const node: SLSTarget = {
  entry: '{{ runtimeDir }}/node',
  hooks: {
    'done' ({ rollupConfig }) {
      const entry = relative(process.cwd(), rollupConfig.output.file).replace(/\.js$/, '')
      consola.info(`Ready to deploy lambda: \`${entry}\``)
      consola.info(`You can try using \`node ${entry} [path]\``)
    }
  }
}
