<template>
  <div>
    <h3>child: {{ date }}</h3>
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
