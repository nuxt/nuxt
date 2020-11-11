
import { relative } from 'path'
import consola from 'consola'
import { SLSTarget } from '../config'

export const lambda: SLSTarget = {
  entry: '{{ runtimeDir }}/targets/lambda',
  hooks: {
    'done' ({ rollupConfig }) {
      const entry = relative(process.cwd(), rollupConfig.output.file).replace(/\.js$/, '')
      consola.info(`Ready to deploy lambda: \`${entry}\``)
    }
  }
}
