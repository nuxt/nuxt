<template>
  <div>{{ fooChild }}</div>
</template>

<script>
export default defineNuxtComponent({
  asyncData () {
    return {
      fooChild: 'fooChild'
    }
  }
})
</script>
