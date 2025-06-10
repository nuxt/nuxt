export default defineNuxtPlugin(() => {
  useCookie('set-in-plugin').value = 'true'
})
