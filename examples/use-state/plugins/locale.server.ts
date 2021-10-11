import { useState } from '#app'

export default defineNuxtPlugin((nuxt) => {
  const locale = useState('locale')
  locale.value = nuxt.ssrContext.req.headers['accept-language']?.split(',')[0]
})
