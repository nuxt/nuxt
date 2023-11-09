export default defineNuxtPlugin({
  name: 'depends-on-plugin',
  dependsOn: ['async-plugin'],
  async setup() {
    await new Promise(resolve => setTimeout(resolve, 100))
  },
  parallel: true
})
