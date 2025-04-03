export default defineNuxtConfig({
  modules: [
    function customLayerInlineModule () {},
    import.meta.dirname + '/module',
  ],
  css: ['custom.css'],
})
