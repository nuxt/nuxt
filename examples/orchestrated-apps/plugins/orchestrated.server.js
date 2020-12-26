export default function orchestratedAppPlugin (ctx) {
  if (ctx.route.name !== 'orchestrated-component') {
    return
  }
  ctx.ssrContext.orchestrated = ctx.route.params.component
  ctx.ssrContext.excludeStyles = ctx.route.query.excludeStyles === '1'
  ctx.ssrContext.excludeScripts = ctx.route.query.excludeScripts === '1'
}
