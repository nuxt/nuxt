export default defineNuxtConfig({
  extends: ['./custom'],
  modules: [
    import.meta.dirname + '/module',
    function projectInlineModule () {},
    function css (_options, nuxt) {
      nuxt.options.css.push('new-css-added-by-module.css')
    },
  ],
  css: ['final-project.css', 'duplicate.css'],
})
