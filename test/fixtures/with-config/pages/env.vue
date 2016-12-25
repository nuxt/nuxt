<template>
  <pre>{{ env }}</pre>
</template>

<script>
export default {
  layout: 'custom-env',
  data ({ env }) {
    return { env }
  }
}
</script>
