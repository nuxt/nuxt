export default defineNuxtPlugin({
  env: { islands: false },
  setup () {
    useCookie('set-in-plugin').value = 'true'
  },
})
