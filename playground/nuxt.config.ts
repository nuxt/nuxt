export default defineNuxtConfig({
  // TODO: Cannot create property 'global' on boolean 'false'
  ssr: true,
  builder: 'rspack',
  app: {
    head: {
      link: [{ rel: 'stylesheet', href: 'https://unpkg.com/@picocss/pico@1.*/css/pico.min.css' }]
    }
  },
  sourcemap: false
})
