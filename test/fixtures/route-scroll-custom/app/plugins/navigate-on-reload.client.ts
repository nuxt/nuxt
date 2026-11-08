export default defineNuxtPlugin(async () => {
  if (sessionStorage.getItem('navigate-on-reload')) {
    sessionStorage.removeItem('navigate-on-reload')
    await useRouter().push('/big-page-2')
  }
})
