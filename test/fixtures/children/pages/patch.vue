<template>
  <div>
    <h1>patch: <i data-date-patch>{{ date }}</i></h1>
    <nuxt-child/>
  </div>
</template>

<script>
export default {
  layout: 'patch',
  asyncData() {
    return {
      date: Date.now()
    }
  }
}
</script>
