<template>
  <div>
    <p>Hi from {{ name }}</p>
    <NLink to="/">
      Home page
    </NLink>
  </div>
</template>

<script>
export default {
  asyncData () {
    return {
      name: process.static ? 'static' : (process.server ? 'server' : 'client')
    }
  },
  head: {
    title: 'About page'
  }
}
</script>
