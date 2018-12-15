<template>
  <div>
    <h3>I am the blue page</h3>
    <p>I am a child of /parent, and the theme is overwritten by myself!</p>
    <p>
      Go back to
      <NuxtLink to="/parent">
        Parent
      </NuxtLink>
    </p>
  </div>
</template>

<script>
export default {
  meta: {
    theme: 'blue'
  }
}
</script>
