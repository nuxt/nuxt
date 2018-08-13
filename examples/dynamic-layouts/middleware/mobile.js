export default function (ctx) {
  const userAgent = ctx.req ? ctx.req.headers['user-agent'] : navigator.userAgent
  ctx.isMobile = /mobile/i.test(userAgent)
}
