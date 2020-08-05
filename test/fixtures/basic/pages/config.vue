<template>
  <div>
    <span v-for="(key,i) in configKeys" :id="key" :key="i">
      {{ vueConfig[key] | toStr }}
    </span>
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
    configKeys () {
      return Object.keys(this.vueConfig).filter(k => ['silent', 'devtools', 'performance', 'productTip'].includes(k))
    }
  }
}
</script>
