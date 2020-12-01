<template>
  <div>Redirecting...</div>
</template>

<script>
export default {
  middleware ({ redirect }) {
    return redirect('https://nuxtjs.org/docs/2.x/features/data-fetching/')
  }
}
</script>
