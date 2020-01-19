const { loadNuxt, build } = require('nuxt')

const main = async () => {
  const nuxt = await loadNuxt({ for: 'dev' })
  build(nuxt)
  await nuxt.listen(3000)
}

main()
