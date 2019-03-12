<template>
  <p v-if="$isFetching"><i>Written by ...</i></p>
  <p v-else>
    Written by {{ user.name }} <button @click="$fetch">Refresh</button>
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
    this.user = await fetch(`https://jsonplaceholder.typicode.com/users/${this.userId}`).then((res) => res.json())
  }
}
</script>
