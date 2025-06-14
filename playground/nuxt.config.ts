export default defineNuxtConfig({
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  contentSecurityPolicy: {
    value: {
      'base-uri': ['\'none\''],
      'font-src': ['\'self\'', 'https:', 'data:'],
      'form-action': ['\'self\''],
      'frame-ancestors': ['\'self\''],
      'img-src': ['\'self\'', 'data:'],
      'object-src': ['\'none\''],
      'script-src-attr': ['\'none\''],
      'style-src': ['\'self\'', 'https:', '\'unsafe-inline\''],
      'script-src': ['\'self\'', 'https:', '\'unsafe-inline\'', '\'strict-dynamic\'', '\'nonce-{{nonce}}\''],
      'upgrade-insecure-requests': true,
    },
  },
})
