<template>
  <div>
    <p>Hi from {{ name }}</p>
    <NuxtLink to="/">
      Home page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  asyncData() {
    return {
      name: process.server ? 'server' : 'client'
    }
  }
}
</script>
