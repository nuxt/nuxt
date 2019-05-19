<template>
  <div>
    <h1>Welcome!</h1>
    <NLink to="/about">
      About Page
    </NLink>
  </div>
</template>

<script>
export default {
  head: {
    title: 'Home page'
  },
  created() {
    console.log(123, this.$route)
  }
}
</script>
