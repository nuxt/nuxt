// the same server auto-imports the handler could use implicitly, named explicitly
// https://github.com/nuxt/nuxt/issues/33979
import { autoimportedFunction, testUtils } from '#imports/server'

export default defineEventHandler(() => {
  return {
    thisIs: autoimportedFunction(),
    fromServerDir: testUtils,
  }
})
