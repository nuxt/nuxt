<template>
  <div>
    <p>Query (SSR): <pre v-text="q" /> </p>
    <p>Params (SSR): <pre v-text="p" /> </p>
  </div>
</template>

<script>
export default {
  asyncData ({ route }) {
    return {
      q: JSON.stringify(route.query),
      p: JSON.stringify(route.params)
    }
  }
}
</script>
