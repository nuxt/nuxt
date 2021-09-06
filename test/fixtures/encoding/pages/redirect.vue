<template>
  <div>
    Redirecting...
  </div>
</template>

<script>
export default {
  asyncData ({ redirect }) {
    return redirect('/dynamic/重新导向?foo bar')
  }
}
</script>
