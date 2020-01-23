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
  async fetch () {
    this.team = await fetch('/team.json').then(res => res.json())
  },
  data () {
    return {
      team: []
    }
  },
  fetchOnServer: false
}
</script>
