<template>
  <h4>_id: {{ date }}</h4>
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
