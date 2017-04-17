<template>
  <div>
    <input v-model="msg">
    <p>msg: {{msg}}</p>
    <p>env: {{env}}</p>
    <p>computed msg: {{computedMsg}}</p>
    <button @click="greet">Greet</button>
    <p><nuxt-link to="/about">About page</nuxt-link></p>
  </div>
</template>

<script>
import Vue from 'vue'
import Component from 'nuxt-class-component'

@Component()

export default class App extends Vue {
  // initial data
  msg = 123

  asyncData ({ req }) {
    return { env: req ? 'server' : 'client' }
  }

  // lifecycle hook
  mounted () {
    this.greet()
  }

  // computed
  get computedMsg () {
    return 'computed ' + this.msg
  }

  // method
  greet () {
    console.log('greeting: ' + this.msg)
  }
}
</script>
