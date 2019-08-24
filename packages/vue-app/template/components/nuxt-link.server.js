import Vue from 'vue'

<%= isTest ? '// @vue/component' : '' %>
export default {
  name: 'NuxtLink',
  extends: Vue.component('RouterLink'),
  props: {
    prefetch: {
      type: Boolean,
      default: <%= router.prefetchLinks ? 'true' : 'false' %>
    },
    noPrefetch: {
      type: Boolean,
      default: false
    }
  }
}
