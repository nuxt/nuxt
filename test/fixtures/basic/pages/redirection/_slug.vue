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
      redirect(route)
    }

    return {}
  }
}
</script>
