export default defineEventHandler((event) => {
  setResponseHeader(event, 'x-stamp', 'yes')
})
