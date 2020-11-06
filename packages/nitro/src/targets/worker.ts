import { SLSTarget } from '../config'

export const worker: SLSTarget = {
  entry: '{{ runtimeDir }}/worker',
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
