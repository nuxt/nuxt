import { defineCachedEventHandler } from '#internal/nitro'

export default defineCachedEventHandler(() => {
  return {
    // TODO: support route rules for payload extraction
    static: ['/**']
  }
})
