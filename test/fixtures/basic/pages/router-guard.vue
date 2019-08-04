<template>
  <div>Router Guard</div>
</template>

<script>
export default {
  beforeRouteEnter (to, from, next) {
    next({ path: '/async-data' })
  }
}
</script>
