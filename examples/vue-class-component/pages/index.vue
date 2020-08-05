<template>
  <Child :env="env" />
</template>

<script>
import Vue from 'vue'
import Component from 'nuxt-class-component'
import Child from '@/components/Child'

export default
@Component({
  components: { Child }
})
class App extends Vue {
  asyncData ({ req }) {
    return { env: req ? 'server' : 'client' }
  }
}
</script>
