const { loadNuxt, build } = require('nuxt')

const main = async () => {
  const nuxt = await loadNuxt({ for: 'build' })
  await build(nuxt)
}

main()
