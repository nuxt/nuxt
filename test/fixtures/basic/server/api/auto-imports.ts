import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  return {
    thisIs: autoimportedFunction(),
    autoImported: someUtils,
    fromServerDir: testUtils,
  }
})
