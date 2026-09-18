export default defineNuxtConfig({
  extends: ['../../../../shared'],
  runtimeConfig: {
    public: {
      who: 'b',
      fromB: true,
    },
  },
})
