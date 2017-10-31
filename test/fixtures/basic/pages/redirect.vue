<template>
  <div>Redirecting...</div>
</template>

<script>
export default {
  fetch({ redirect }) {
    return redirect('/')
  }
}
</script>
