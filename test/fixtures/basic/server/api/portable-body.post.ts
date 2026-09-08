export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string }>(event)

  return {
    middleware: event.context.portableBody,
    handler: body?.name ?? null,
  }
})
