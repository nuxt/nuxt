<template>
  <div>Redirecting...</div>
</template>

<script>
export default {
  middleware ({ redirect }) {
    return redirect({ name: 'stateless' })
  }
}
</script>
