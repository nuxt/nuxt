<template>
  <div>
    <p v-if="$fetchState.pending">
      Fetching...
    </p>
    <pre v-else>
      {{ team }}
      value: {{ func() }}
      mounted: {{ mounted }}
    </pre>
    <div :id="mounted ? 'mounted' : null" />
  </div>
</template>

<script>
export default {
  async fetch () {
    const url = (process.server && !process.static ? `http://${this.$ssrContext.req.headers.host}` : '')

    this.team = await fetch(`${url}/team.json`).then(res => res.json())
  },
  data () {
    return {
      mounted: false,
      team: [],
      func: () => 42
    }
  },
  mounted () {
    this.mounted = true
  }
}
</script>
