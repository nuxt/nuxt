<template>
  <div>
    <h2>_id: <i data-date-id>{{ date }}</i></h2>
    <nuxt-child/>
  </div>
</template>

<script>
export default {
  asyncData() {
    return {
      date: Date.now()
    }
  }
}
</script>
