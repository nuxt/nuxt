<template>
  <div>
    <p v-if="$fetchState.pending">
      Fetching...
    </p>
    <p v-else-if="$fetchState.error">
      {{ $fetchState.error }}
    </p>
    <pre v-else>{{ team }}</pre>
  </div>
</template>

<script>
export default {
  async fetch () {
    const url = (process.server ? `http://${this.$ssrContext.req.headers.host}` : '')

    this.team = await fetch(`${url}/team.json`).then(res => res.json())
  },
  data () {
    return {
      team: []
    }
  }
}
</script>
