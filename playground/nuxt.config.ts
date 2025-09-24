const runtimeConfig = {
  foo: {
    bar: 1,
  },
}

export default defineNuxtConfig({
  devtools: { enabled: true },
  runtimeConfig,
  compatibilityDate: 'latest',
})
