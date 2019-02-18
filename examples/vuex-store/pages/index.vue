<template>
  <div>
    <p>
      <button @click="increment">
        {{ counter }}
      </button><br>
      <NuxtLink to="/about">
        About
      </NuxtLink>
    </p>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: mapState([
    'counter'
  ]),
  // fetch(context) is called by the server-side
  // and nuxt before instantiating the component
  fetch({ store }) {
    store.commit('increment')
  },
  methods: {
    increment() {
      this.$store.commit('increment')
    }
  }
}
</script>
