<template>
  <div>
    <p>{{ counter }}</p>
    <p>
      <button @click="increment">+</button>
      <button @click="decrement">-</button>
    </p>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex'

export default {
  computed: {
    ...mapState(['counter'])
  },
  methods: {
    ...mapMutations(['increment', 'decrement'])
  }
}
</script>
