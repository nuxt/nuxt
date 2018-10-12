<template>
  <div>
    <h1>{{ counter }}</h1>
    <button id="changeState" @click="increment">Increment</button>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
  computed: {
    ...mapState(['counter'])
  },
  methods: {
    ...mapActions(['increment'])
  }
}
</script>
