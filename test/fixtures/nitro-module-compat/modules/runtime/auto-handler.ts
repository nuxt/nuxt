// no imports: Nitro v2 auto-imported these names for module code
export default defineEventHandler((event) => {
  return {
    flavour: useRuntimeConfig(event).public.flavour,
    hasNitroApp: typeof useNitroApp === 'function',
  }
})
