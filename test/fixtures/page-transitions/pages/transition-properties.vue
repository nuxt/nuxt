<template>
  <div>
    <h1>Transition properties page</h1>
    <NuxtChild />
  </div>
</template>

<script>
export default {
  transition: {
    name: 'custom',
    appear: true,
    css: false,
    mode: 'in-out',
    duration: 3000
  }
}
</script>
