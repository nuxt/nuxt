<template>
<div>
  Hello SPA!
</div>
</template>

<script>
export default {
  layout: 'custom',
  mounted () {
    window.indexMounted = (+window.indexMounted) + 1
    console.log('mounted')
  }
}
</script>