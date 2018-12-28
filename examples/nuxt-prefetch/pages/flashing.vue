<template>
  <div>
    <nuxt-link v-for="link of $store.state.links" :key="link" :to="{ name: link }">/{{ link }}</nuxt-link>
  </div>
</template>

<script>
export default {
  head() {
    return {
      title: this.$route.name
    }
  }
}
</script>
