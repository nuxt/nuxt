export function getViteNodeOptions () {
  return JSON.parse(process.env.NUXT_VITE_NODE_OPTIONS || '{}')
}
