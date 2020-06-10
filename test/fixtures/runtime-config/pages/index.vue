<template>
  <pre v-text="JSON.stringify(config, null, 2)" />
</template>

<script>
export default {
  asyncData ({ $config }) {
    return {
      serverConfig: $config
    }
  },
  data () {
    return {
      clientConfig: { please: 'wait' }
    }
  },
  computed: {
    config () {
      return {
        client: this.clientConfig,
        server: this.serverConfig,
        $config: this.$config
      }
    }
  },
  mounted () {
    this.clientConfig = this.$config
  }
}
</script>
