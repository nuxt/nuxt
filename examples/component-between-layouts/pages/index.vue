<template>
  <div>
    <h1>Welcome!</h1>
    <NuxtLink to="/about">
      About page
    </NuxtLink>

    <button @click="onClick">
      Click to fill input
    </button>
  </div>
</template>

<script>
export default {
  methods: {
    onClick () {
      this.$nuxt.$rootComponents.first.text = 'Text from page'
    }
  }
}
</script>
