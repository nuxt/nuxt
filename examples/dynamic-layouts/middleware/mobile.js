export default function (ctx) {
  let userAgent = ctx.req ? ctx.req.headers['user-agent'] : navigator.userAgent
  ctx.isMobile = /mobile/i.test(userAgent)
}
