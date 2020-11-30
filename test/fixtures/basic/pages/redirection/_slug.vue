<template>
  <h1>
    Redirected page
  </h1>
</template>

<script>
export default {
  asyncData ({ redirect, route }) {
    if (process.server) {
      // Redirect to the same route
      // redirect(decodeURI(route.path))
      redirect(route.path)
    }

    return {}
  }
}
</script>
