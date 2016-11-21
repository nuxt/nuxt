<template>
  <div>
    <p>Hi from {{ name }}</p>
    <router-link to="/">Home page</router-link>
  </div>
</template>

<script>
export default {
  data ({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  }
}
</script>
