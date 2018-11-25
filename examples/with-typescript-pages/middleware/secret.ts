export default (ctx) => {
  if (ctx.route.query.password !== 'password') {
    ctx.redirect({ name: 'index' })
  }
}
