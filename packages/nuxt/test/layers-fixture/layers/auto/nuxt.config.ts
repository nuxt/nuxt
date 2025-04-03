export default defineNuxtConfig({
  modules: [
    function autoLayerInlineModule () {},
    import.meta.dirname + '/module',
  ],
  css: ['duplicate.css', 'auto.css'],
})
