export default defineEventHandler(() => ({ secret: useRuntimeConfig().app.secret }))
