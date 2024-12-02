export default defineNuxtPlugin(() => {
  const fetchCustom = $fetch.create({
    baseURL: '',
  })

  return {
    provide: {
      fetchCustom,
    },
  }
})
