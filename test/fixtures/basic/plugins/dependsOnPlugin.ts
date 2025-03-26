export default defineNuxtPlugin({
  name: 'depends-on-plugin',
  dependsOn: ['async-plugin'],
  async setup () {
    const nuxtApp = useNuxtApp()
    if (!nuxtApp.$asyncPlugin) {
      throw new Error('$asyncPlugin is not defined')
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  },
  parallel: true,
})
