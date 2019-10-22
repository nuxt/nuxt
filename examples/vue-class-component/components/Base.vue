<template>
  <div>
    <input v-model="msg">
    <p>msg: {{ msg }}</p>
    <p>env: {{ env }}</p>
    <p>computed msg: {{ computedMsg }}</p>
    <button @click="greet">
      Greet
    </button>
    <p>
      <NuxtLink to="/about">
        About page
      </NuxtLink>
    </p>
  </div>
</template>

<script>
import Vue from 'vue'
import Component from 'nuxt-class-component'

export default
@Component({
  props: {
    env: String
  }
})
class Base extends Vue {
  // initial data
  msg = 123

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
    console.log('base greeting: ' + this.msg) // eslint-disable-line no-console
  }
}
</script>
