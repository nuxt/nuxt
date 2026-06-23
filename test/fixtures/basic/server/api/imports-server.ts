// Explicit imports of server-only auto-imports via `#imports/server`
import { autoimportedFunction, someUtils, testUtils } from '#imports/server'

export default defineEventHandler(() => {
  return {
    thisIs: autoimportedFunction(),
    autoImported: someUtils,
    fromServerDir: testUtils,
  }
})
