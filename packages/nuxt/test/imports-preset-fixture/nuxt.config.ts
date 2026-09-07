export default defineNuxtConfig({
  imports: {
    presets: [
      {
        from: 'nuxt/dist/composables/router',
        imports: ['NavigateToOptions'],
        type: true,
      },
      {
        from: '~/utils/missing',
        imports: ['missingUtil'],
      },
      {
        from: '~/utils/existing',
        imports: ['existingUtil'],
      },
    ],
  },
})
