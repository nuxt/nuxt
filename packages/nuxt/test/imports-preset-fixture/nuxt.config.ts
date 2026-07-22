export default defineNuxtConfig({
  imports: {
    presets: [
      {
        from: 'nuxt/dist/composables/router',
        imports: ['NavigateToOptions'],
        type: true,
      },
    ],
  },
})
