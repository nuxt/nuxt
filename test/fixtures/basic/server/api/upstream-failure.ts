export default defineEventHandler((event) => {
  setResponseStatus(event, 502)
  return { secret: 'upstream-secret' }
})
