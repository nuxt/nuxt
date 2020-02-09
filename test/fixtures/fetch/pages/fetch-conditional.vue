<template>
  <div>
    <nuxt-link to="/fetch-conditional?fetch_client=true">
      Fetch on client
    </nuxt-link>
    <p v-if="$fetchState.pending">
      Fetching...
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
  },
  fetchOnServer () {
    return !this.$route.query.fetch_client
  }
}
</script>
