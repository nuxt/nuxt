const { loadNuxt } = require('nuxt-start')

const main = async () => {
  const nuxt = await loadNuxt({ for: 'start' })
  await nuxt.listen(3000)
}

main()
