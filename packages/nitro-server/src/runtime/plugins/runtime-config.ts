import type { NitroApp } from 'nitropack/types'

import { useRuntimeConfig } from '../runtime-config'

export default (_nitroApp: NitroApp): void => {
  useRuntimeConfig()
}
