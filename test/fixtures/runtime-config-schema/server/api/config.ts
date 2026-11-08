export default defineEventHandler((event) => {
  const pick = (config: ReturnType<typeof useRuntimeConfig>) => ({
    apiSecret: config.apiSecret,
    port: config.port,
    plain: config.plain,
    mode: config.public.mode,
    flag: config.public.flag,
  })
  return {
    event: pick(useRuntimeConfig(event)),
    shared: pick(useRuntimeConfig()),
  }
})
