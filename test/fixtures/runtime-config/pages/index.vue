<template>
  <div>
    $config:
    <pre v-text="JSON.stringify($config)" />
    Server Config:
    <pre v-text="JSON.stringify(serverConfig)" />
    ClientConfig:
    <pre v-text="JSON.stringify(clientConfig)" />
  </div>
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
      clientConfig: '...'
    }
  },
  mounted () {
    this.clientConfig = this.$config
  }
}
</script>
