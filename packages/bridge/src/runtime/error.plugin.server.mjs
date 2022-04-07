export default (ctx) => {
  if (ctx.ssrContext.error) {
    ctx.error(ctx.ssrContext.error)
  }
}
