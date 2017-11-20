<template>
  <div>
    <h1>Super secret page</h1>
    <p>If you try to access this URL not connected, you will see the error page telling your that you are not connected.</p>
    <nuxt-link to="/">Back to the home page</nuxt-link>
  </div>
</template>

<script>
export default {
  middleware: 'auth'
}
</script>
