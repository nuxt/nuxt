<template>
  <div v-text="JSON.stringify(payload)" />
</template>

<script>
export default {
  asyncData ({ payload }) {
    return {
      payload
    }
  }
}
</script>
