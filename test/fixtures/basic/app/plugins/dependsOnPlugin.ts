export default defineNuxtPlugin({
  name: 'depends-on-plugin',
  dependsOn: ['client-only-plugin', 'server-only-plugin', 'async-plugin'],
  async setup () {
    const nuxtApp = useNuxtApp()
    if (!nuxtApp.$asyncPlugin) {
      throw new Error('$asyncPlugin is not defined')
    }
    await new Promise(resolve => setTimeout(resolve, 100))
    return {
      provide: {
        dependsOnPlugin: () => 'Plugin with environment-specific dependencies works!',
      },
    }
  },
})
