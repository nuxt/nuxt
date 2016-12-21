<template>
  <h1>Error page</h1>
</template>

<script>
export default {
  data ({ error }) {
    error({ message: 'Custom error' })
  }
}
</script>
