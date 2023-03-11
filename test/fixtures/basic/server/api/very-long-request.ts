export default defineEventHandler(async () => {
  await timeout(1000)
  return 'that was very long ...'
})
function timeout (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
