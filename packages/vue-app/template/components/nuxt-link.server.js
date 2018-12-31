<%= isTest ? '// @vue/component' : '' %>
import Vue from 'vue'

export default {
  extends: Vue.component('RouterLink'),
  name: 'NuxtLink',
  props: {
    noPrefetch: {
      type: Boolean,
      default: false
    }
  }
}
