<template>
  <div />
</template>

<script>
export default {
  asyncData ({ error }) {
    return error({ statusCode: 403 })
  }
}
</script>
