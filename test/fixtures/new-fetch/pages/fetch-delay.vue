<template>
  <div>
    <p v-if="$fetchState.pending">Fetching for 1 second</p>
    <pre v-else>{{ team }}</pre>
  </div>
</template>

<script>
export default {
  data() {
    return {
      team: []
    }
  },
  fetchDelay: 1000,
  async fetch() {
    const url = (process.server ? `http://${this.$ssrContext.req.headers.host}` : '')

    this.team = await fetch(`${url}/team.json`).then(res => res.json())
  }
}
</script>
