<template>
  <div>Redirecting...</div>
</template>

<script>
export default {
  middleware ({ redirect }) {
    return redirect('https://example.com/test/')
  }
}
</script>
