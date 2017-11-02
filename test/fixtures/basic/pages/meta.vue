<template>
  <pre>{{ $store.state.meta }}</pre>
</template>

<script>
export default {
  middleware: 'meta',
  meta: {
    works: true
  }
}
</script>
