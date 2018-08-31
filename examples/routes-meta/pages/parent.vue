<template>
  <div>
    <h1>Parent</h1>
    Checkout
    <nuxt-link to="/parent/blue">Blue page</nuxt-link>
    <nuxt-child/>
  </div>
</template>

<script>
export default {
  meta: {
    theme: 'orange'
  }
}
</script>
