<template>
  <div>
    <h1>Parent</h1>
    Checkout
    <NuxtLink to="/parent/blue">
      Blue page
    </NuxtLink>
    <NuxtChild />
  </div>
</template>

<script>
export default {
  meta: {
    theme: 'orange'
  }
}
</script>
