export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  return {
    flavour: config.public.flavour,
    fromQuery: getQuery(event).q ?? null,
  }
})
