export default defineEventHandler((event) => {
  const cookie = getCookie(event, 'session')
  const auth = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  const principal = cookie || auth || null
  if (!principal) {
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' })
  }
  return {
    principal,
    marker: `MARKER-${principal}`,
    secret: `secret-for-${principal}`,
  }
})
