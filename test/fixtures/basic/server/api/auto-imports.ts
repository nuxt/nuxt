export default defineEventHandler(() => {
  return {
    thisIs: autoimportedFunction(),
    autoImported: someUtils,
    fromServerDir: testUtils
  }
})
