<template>
  <div>
    <div>Query (SSR): <pre v-text="q" /> </div>
    <div>Params (SSR): <pre v-text="p" /> </div>
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
