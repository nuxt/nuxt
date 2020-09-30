<template>
  <div>
    <h1>Info</h1>
    <button
      type="button"
      @click="onClick"
    >
      click me
    </button>
    <nuxt-link to="/">
      back
    </nuxt-link>
  </div>
</template>

<script>
export default {
  methods: {
    onClick () {
      this.$nuxt.context.error(new Error('test error'))
    }
  }
}
</script>
