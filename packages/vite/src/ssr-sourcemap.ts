import type { NitroApp } from 'nitro/types'
import { getCode, getCompiledPosition } from '#vite-node-runner'

export default (nitroApp: NitroApp): void => {
  nitroApp.ssrSourceMaps = { getCode, getCompiledPosition }
}
