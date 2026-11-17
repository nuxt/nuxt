export default defineNuxtPlugin(() => {
  useHead({ meta: [{ name: 'description', content: 'Set by a plugin' }] })
})
