<template>
  <p v-if="$fetchState.error">
    Could not fetch Author
  </p>
  <p v-else>
    Written by {{ $fetchState.pending ? '...' : user.name }} <button @click="$fetch">
      Refresh
    </button>
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
  async fetch () {
    this.user = await this.$http.$get(`https://jsonplaceholder.typicode.com/users/${this.userId}`)
  },
  data () {
    return {
      user: {}
    }
  },
  fetchOnServer: false
}
</script>
