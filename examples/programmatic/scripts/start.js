const { loadNuxt } = require('nuxt')

const main = async () => {
  const nuxt = await loadNuxt({ for: 'start' })
  await nuxt.listen(3000)
}

main()
