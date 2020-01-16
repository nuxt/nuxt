<template>
  <p v-if="$fetchError">Could not fetch Author</p>
  <p v-else>
    Written by {{ $isFetching ? '...' : user.name }} <button @click="$fetch">Refresh</button>
  </p>
</template>

<script>
export default {
  props: {
    userId: {
      type: Number,
      required: true
    }
  },
  data() {
    return {
      user: {}
    }
  },
  fetchOnServer: false,
  async fetch() {
    this.user = await this.$http.$get(`https://jsonplaceholder.typicode.com/users/${this.userId}`)
  }
}
</script>
