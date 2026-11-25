export default defineEventHandler((event) => {
  const session = getCookie(event, 'session')
  if (session) {
    event.context.session = session
  }
})
