export default defineNuxtPlugin({
  name: 'server-timing-test-plugin',
  async setup () {
    await new Promise(resolve => setTimeout(resolve, 25))
  },
})
