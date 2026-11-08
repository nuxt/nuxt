import { definePlugin } from 'nitro'

import { useRuntimeConfig } from '../runtime-config'

export default definePlugin(() => {
  useRuntimeConfig()
})
