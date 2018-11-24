<template>
  <div class="container">
    <h1>Welcome!</h1>
    <NuxtLink to="/about">
      About page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: ({ isMobile }) => isMobile ? 'mobile' : 'default'
}
</script>
