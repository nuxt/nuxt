export default defineEventHandler((event) => {
  const ms = getRouterParam(event, 'ms')
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        message: `Hello from hey after ${ms}ms`,
      })
    }, ms ? +ms : 0)
  })
})
