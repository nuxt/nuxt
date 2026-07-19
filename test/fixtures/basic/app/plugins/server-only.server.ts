export default defineNuxtPlugin({
  name: 'server-only-plugin',
  setup () {
    const evt = useRequestEvent()
    if (evt) {
      evt.res.headers.set('custom-head', 'hello')
    }
  },
  env: {
    islands: false,
  },
})
