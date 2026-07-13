import { useRuntimeConfig } from 'nitro/runtime-config'
import { defineHandler } from 'h3'

export default defineHandler(() => {
  return { ok: !!useRuntimeConfig() }
})
