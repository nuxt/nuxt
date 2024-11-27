export default defineNuxtPlugin(() => {
  const fetchCustom = $fetch.create({
    baseURL: 'https://this-doesnt-matter.com',
  })

  return {
    provide: {
      fetchCustom,
    },
  }
})
