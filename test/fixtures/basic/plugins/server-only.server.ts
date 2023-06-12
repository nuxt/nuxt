import { setHeader } from 'h3'

export default defineNuxtPlugin({
  name: 'server-only-plugin',
  setup () {
    const evt = useRequestEvent()
    setHeader(evt, 'custom-head', 'hello')
  },
  env: {
    islands: false
  }
})
