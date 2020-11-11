import { relative } from 'path'
import consola from 'consola'
import { SLSTarget } from '../config'

export const node: SLSTarget = {
  entry: '{{ runtimeDir }}/targets/node',
  outName: 'index.js',
  hooks: {
    'done' ({ rollupConfig }) {
      const entry = relative(process.cwd(), rollupConfig.output.file)
        .replace(/\.js$/, '')
        .replace(/\/index$/, '')
      consola.info(`Ready to deploy node entrypoint: \`${entry}\``)
      consola.info(`You can try using \`node ${entry} [path]\``)
    }
  }
}
