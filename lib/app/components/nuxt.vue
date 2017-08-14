<template>
  <nuxt-error v-if="nuxt.err" :error="nuxt.err"></nuxt-error>
  <nuxt-child :key="routerViewKey" v-else></nuxt-child>
</template>

<script>
import Vue from 'vue'
import NuxtChild from './nuxt-child'
import NuxtError from '<%= components.ErrorPage ? ((components.ErrorPage.includes('~') || components.ErrorPage.includes('@')) ? components.ErrorPage : "../" + components.ErrorPage) : "./nuxt-error.vue" %>'
import { compile } from '../utils'

export default {
  name: 'nuxt',
  props: ['nuxtChildKey'],
  beforeCreate () {
    Vue.util.defineReactive(this, 'nuxt', this.$root.$options._nuxt)
  },
  computed: {
    routerViewKey () {
      // If nuxtChildKey prop is given or current route has children
      if (typeof this.nuxtChildKey !== 'undefined' || this.$route.matched.length > 1) {
        return this.nuxtChildKey || compile(this.$route.matched[0].path)(this.$route.params)
      }
      return this.$route.fullPath.split('#')[0]
    }
  },
  components: {
    NuxtChild,
    NuxtError
  }
}
</script>
