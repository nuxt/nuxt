import type { NitroApp } from 'nitro/types'
import { fixStacktrace, getCode, getSourceMap } from '#vite-node-runner'

export default (nitroApp: NitroApp): void => {
  nitroApp.ssrSourceMaps = { getSourceMap, fixStacktrace, getCode, stacksAreMapped: false }
}
