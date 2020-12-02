<template>
  <div>
    <p>Query (SSR): <pre v-text="q" /></p>
  </div>
</template>

<script>
export default {
  asyncData ({ route }) {
    return {
      q: route.query
    }
  }
}
</script>
