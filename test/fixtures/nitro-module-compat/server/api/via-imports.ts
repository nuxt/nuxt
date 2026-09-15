import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  // @ts-expect-error auto-imported through the module's `addServerImports`
  return useModuleImage()
})
