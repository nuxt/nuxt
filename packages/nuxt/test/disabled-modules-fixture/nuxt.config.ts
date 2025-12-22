export default defineNuxtConfig({
  extends: ['./layers/base'],
  modules: [
    import.meta.dirname + '/project-module',
  ],
})
