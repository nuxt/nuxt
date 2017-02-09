<template>
  <pre>{{ userAgent }}</pre>
</template>

<script>
export default {
  middleware: 'user-agent',
  data ({ userAgent }) {
    return { userAgent }
  }
}
</script>
