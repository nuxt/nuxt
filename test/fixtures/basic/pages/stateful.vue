<template>
  <div>
    <p>The answer is {{ answer }}</p>
  </div>
</template>

<script>
export default {
  data() {
    return { answer: null }
  },
  created() {
    this.answer = 42
  }
}
</script>
