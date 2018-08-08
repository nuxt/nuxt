<template>
  <div>
    <span v-for="key in configKeys" :id="key">{{ vueConfig[key] | toStr }}</span>
  </div>
</template>

<script>
import Vue from 'vue'

export default {
  filters: {
    toStr (v) {
      return String(v)
    }
  },
  data () {
    return {
      vueConfig: Vue.config
    }
  },
  computed: {
    configKeys: function () {
      return Object.keys(this.vueConfig).filter(k => ['silent', 'devtools', 'performance', 'productTip'].includes(k))
    }
  }
}
</script>
