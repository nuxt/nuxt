<template>
  <pre>{{ env }}</pre>
</template>

<script>
export default {
  layout: 'custom-env',
  asyncData ({ env }) {
    return { env }
  }
}
</script>
