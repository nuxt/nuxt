<template>
  <Child :env="env" ></Child>
</template>

<script>
import Vue from 'vue'
import Component from 'nuxt-class-component'
import Child from '@/components/Child'

@Component({
  components: { Child }
})
export default class App extends Vue {
  asyncData({ req }) {
    return { env: req ? 'server' : 'client' }
  }
}
</script>
