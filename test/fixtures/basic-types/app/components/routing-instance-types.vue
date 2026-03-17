<template>
  <button @click="goToHome">
    {{ $route.path }}
  </button>
</template>

<script lang="ts">
export default defineNuxtComponent({
  methods: {
    goToHome () {
      this.$router.push('/')
      return this.navigateTo('/')
    },
  },
})
</script>
