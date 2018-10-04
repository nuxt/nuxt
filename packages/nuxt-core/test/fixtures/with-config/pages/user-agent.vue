<template>
  <pre>{{ userAgent }}</pre>
</template>

<script>
export default {
  middleware: 'user-agent',
  asyncData({ userAgent }) {
    return { userAgent }
  }
}
</script>
