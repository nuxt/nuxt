export default defineNuxtConfig({
  extends: ['./custom'],
  modules: [
    function (_options, nuxt) {
      nuxt.options.css.push('new-css-added-by-module.css')
    },
  ],
  css: ['final-project.css', 'duplicate.css'],
})
