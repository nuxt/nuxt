<template>
  <div>
    <h2>_id: {{ date }}</h2>
    <nuxt-child/>
  </div>
</template>

<script>
export default {
  asyncData() {
    return {
      date: Date.now()
    }
  }
}
</script>
