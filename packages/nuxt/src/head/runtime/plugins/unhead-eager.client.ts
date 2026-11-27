import { defineNuxtPlugin } from '#app/nuxt'
import '../client-head-eager'

// registers the client head factory before anything reads the head through `inject(headSymbol)`
export default defineNuxtPlugin({
  name: 'nuxt:head-eager',
  setup () {},
})
