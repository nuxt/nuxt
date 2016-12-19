
<template>
  <div>
    <p>{{ userAgent }}</p>
    <p><nuxt-link to="/post">See a post (http request / Ajax)</nuxt-link></p>
  </div>
</template>

<script>
export default {
  data ({ req }, callback) {
    setTimeout(function () {
      // callback(err, data)
      callback(null, {
        userAgent: (req ? req.headers['user-agent'] : navigator.userAgent)
      })
    }, 100)
  }
}
</script>

<style scoped>
p {
  font-size: 20px;
  text-align: center;
  padding: 100px;
  padding-bottom: 0;
}
</style>
