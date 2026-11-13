export default defineNuxtConfig({
  modules: [
    import.meta.dirname + '/layer-module-a',
    import.meta.dirname + '/layer-module-b',
    import.meta.dirname + '/layer-module-c',
  ],
})
