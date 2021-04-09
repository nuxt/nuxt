export function getNuxtPkg () {
  return Promise.resolve(require('nuxt3'))
}

export async function loadNuxt (opts) {
  const { loadNuxt } = await getNuxtPkg()
  return loadNuxt(opts)
}

export async function buildNuxt (nuxt) {
  const { build } = await getNuxtPkg()
  return build(nuxt)
}
