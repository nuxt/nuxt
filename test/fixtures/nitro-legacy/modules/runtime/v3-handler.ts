import { defineHandler } from 'nitro/h3'

// @ts-expect-error virtual module provided by the module
import { defineCachedHandler, nodeProbe, probe } from '#legacy-module-runtime'

export default defineHandler(() => {
  return {
    probe,
    nodeProbe,
    hasCachedHandler: typeof defineCachedHandler === 'function',
  }
})
