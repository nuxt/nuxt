<template>
  <ul>
    <li v-for="(post, index) in posts" :key="index">
        <h3>{{ post.date }}</h3>
        <h2><nuxt-link :to="post.link">{{ post.title }}</nuxt-link></h2>
    </li>
    <li style="border:none;text-align: center;font-size: 14px;">Design from <a href="http://blog.evanyou.me" target="_blank">EvanYou.me</a></li>
  </ul>
</template>

<script>
export default {
  data: () => ({
    posts: [
      { date: 'Jul 10, 2017', title: 'Deep dive into the Ocean', link: '/deep-dive-into-ocean' },
      { date: 'Jul 08, 2017', title: 'Welcome to my blog', link: '/welcome-to-my-blog' }
    ]
  })
}
</script>

<style src="@/assets/css/index.css"/>
