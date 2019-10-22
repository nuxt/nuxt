<template>
  <div>
    <h3>Index Module</h3>
    <button @click="increment">
      {{ counter }}
    </button>
    <br>
    <NuxtLink to="/about">
      About
    </NuxtLink>
    <br>
    <br>
    <h3>Todo Module</h3>
    <NuxtLink to="/todos">
      Todos
    </NuxtLink>
    <br>
    <br>
    <h3>Nested Modules</h3>
    <NuxtLink to="/website">
      Website
    </NuxtLink>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: mapState([
    'counter'
  ]),
  // fetch(context) is called by the server-side
  // and before instantiating the component
  fetch ({ store }) {
    store.commit('increment')
  },
  methods: {
    increment () {
      this.$store.commit('increment')
    }
  }
}
</script>
