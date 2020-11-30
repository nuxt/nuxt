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
    this.team = await fetch('/team.json').then(res => res.json())
  },
  fetchOnServer: false
}
</script>
