<template>
  <h1>{{ status }}</h1>
</template>

<script>
export default {
  data () {
    return {
      status: 'not mounted'
    }
  },
  mounted () {
    this.status = 'mounted'
  }
}
</script>
