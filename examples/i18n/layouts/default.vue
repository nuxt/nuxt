<template>
  <div>
    <header class="Header">
      <div class="container">
        <h1 class="Header__Title">Nuxt i18n</h1>
        <nav class="Header__Menu">
          <nuxt-link class="Header__Link" :to="path('/')">
            {{ $t('message.home') }}
          </nuxt-link>
          <nuxt-link class="Header__Link" :to="path('/about')">
            {{ $t('message.about') }}
          </nuxt-link>
          <nuxt-link class="Header__Link" v-if="$route.params.lang" to="/">
            {{ $t('message.english') }}
          </nuxt-link>
          <nuxt-link class="Header__Link" v-else to="/fr">
            {{ $t('message.french') }}
          </nuxt-link>
        </nav>
      </div>
    </header>
    <nuxt/>
  </div>
</template>

<script>
export default {
  methods: {
    path (url) {
      console.log(this.$route.params.lang + url)
      return (this.$route.params.lang) ? this.$route.params.lang + url : url
    }
  }
}
</script>

<style>
html, body
{
  background-color: #fff;
  color: #2e2f30;
  letter-spacing: 0.5px;
  font-size: 18px;
  font-family: "Source Sans Pro", Arial, sans-serif;
  height: 100vh;
  margin: 0;
}
*, *:before, *:after
{
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}
.container
{
  width: 75%;
  margin: 0 auto;
}
.container:after
{
  content: "";
  display: table;
  clear: both;
}
.Header
{
  color: #fff;
  height: 80px;
  line-height: 80px;
  background-color: #2e2f30;
}
.Header__Title
{
  float: left;
  font-weight: 300;
  font-size: 30px;
}
.Header__Menu
{
  float: right;
}
.Header__Link
{
  font-size: 16px;
  color: #fff;
  border: 1px solid #fff;
  padding: 7px 12px;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: 5px;
  margin-left: 10px;
}
.Header__Link:hover
{
  color: #2e2f30;
  background-color: #fff;
}
</style>
