<template>
  <div>
    <NLink v-if="i>0" :to="`./${i-1}`">
      Previous
    </NLink>
    Page {{ i }}
    <NLink v-if="i<5" :to="`./${i+1}`">
      Next
    </NLink>
  </div>
</template>

<script>
export default {
  computed: {
    i () {
      return parseInt(this.$route.params.i) || 0
    }
  }
}
</script>
