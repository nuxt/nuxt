<template>
  <div>
    <p>
      <h3>Index Module</h3>
      <button @click="increment">{{ counter }}</button>
      <br>
      <nuxt-link to="/about">About</nuxt-link>
      <br>
      <br>
      <h3>Todo Module</h3>
      <nuxt-link to="/todos">Todos</nuxt-link>
      <br>
      <br>
      <h3>Nested Modules</h3>
      <nuxt-link to="/website">Website</nuxt-link>
    </p>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  // fetch(context) is called by the server-side
  // and before instantiating the component
  fetch({ store }) {
    store.commit('increment')
  },
  computed: mapState([
    'counter'
  ]),
  methods: {
    increment() {
      this.$store.commit('increment')
    }
  }
}
</script>
