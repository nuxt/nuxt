export default defineNuxtPlugin({
  name: 'server-only-plugin',
  parallel: true,
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
