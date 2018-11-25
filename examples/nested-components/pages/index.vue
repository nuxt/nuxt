<template lang="html">
  <div class="main">
    <Post title="My first blog post">
      <VP>Hello there</VP>
      <VP>This is an example of a componentized blog post</VP>
    </Post>

    <VHr />

    <Post title="My second blog post">
      <VP>Hello there</VP>
      <VP>This is another example.</VP>
      <VP>Wa-hoo!</VP>
    </Post>

    <VHr />

    <Post title="The final blog post">
      <VP>C'est la fin !</VP>
    </Post>
  </div>
</template>

<script>
import Post from '~/components/post'
import VP from '~/components/paragraph'
const VHr = { render: h => h('hr', { class: 'hr' }) }

export default {
  components: {
    Post,
    VP,
    VHr
  }
}
</script>

<style scoped>
.main {
  margin: auto;
  max-width: 420px;
  padding: 10px;
}
.hr {
  width: 100px;
  border-width: 0;
  margin: 20px auto;
  text-align: center;
}
hr::before {
  content: '***';
  color: #ccc;
}
</style>
