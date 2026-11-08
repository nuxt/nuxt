export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  return {
    moduleToken: config.moduleToken ?? null,
    moduleCount: config.moduleCount,
  }
})
