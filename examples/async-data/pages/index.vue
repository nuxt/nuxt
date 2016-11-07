
<template>
  <div>
    <p>{{ userAgent }}!</p>
    <p><router-link to="/post">See a post (http request / Ajax)</router-link></p>
  </div>
</template>

<script>
export default {
  data ({ req }) {
    return new Promise((resolve) => {
      setTimeout(function () {
        resolve({
          userAgent: (req ? req.headers['user-agent'] : navigator.userAgent)
        })
      }, 1000)
    })
  }
}
</script>

<style>
p {
  font-size: 20px;
  text-align: center;
  padding: 100px;
}
</style>
