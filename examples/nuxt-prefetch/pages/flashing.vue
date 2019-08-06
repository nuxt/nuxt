<template>
  <div>
    <NuxtLink v-for="link of $store.state.links" :key="link" :to="{ name: link }">
      /{{ link }}
    </NuxtLink>
  </div>
</template>

<script>
export default {
  head () {
    return {
      title: this.$route.name
    }
  }
}
</script>
