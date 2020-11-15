<template>
  <div>
    <p v-if="$fetchState.pending">
      Fetching...
    </p>
    <pre v-else>{{ team }}</pre>
  </div>
</template>

<script>
export default {
  data () {
    return {
      team: []
    }
  },
  async fetch () {
    const url = (process.server ? `http://${this.$ssrContext.req.headers.host}` : '')

    this.team = await fetch(`${url}/team.json`).then(res => res.json())
  }
}
</script>
