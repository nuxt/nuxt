<template>
  <div>
    <p>
      <button @click="increment">{{ counter }}</button><br>
      <nuxt-link to="/about">About</nuxt-link>
    </p>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  // fetch(context) is called by the server-side
  // and nuxt before instantiating the component
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
