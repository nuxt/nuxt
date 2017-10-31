<template>
  <div class="player">
    <h1>#{{ number }}</h1>
    <h2>{{ name }}</h2>
  </div>
</template>

<script>
export default {
  validate({ params }) {
    return !isNaN(+params.id)
  },
  asyncData({ params, env, error }) {
    const user = env.users.find((user) => String(user.id) === params.id)
    if (!user) {
      return error({ message: 'User not found', statusCode: 404 })
    }
    return user
  },
  head() {
    return {
      title: this.name
    }
  }
}
</script>

<style scoped>
.player {
  text-align: center;
  margin-top: 100px;
  font-family: sans-serif;
}
</style>
