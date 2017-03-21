<template>
  <div>
    <p>The answer is {{ answer }}</p>
  </div>
</template>

<script>
export default {
  asyncData () {
    return { answer: null }
  },
  created () {
    this.answer = 42
  }
}
</script>
