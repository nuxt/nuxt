<template lang="html">
  <div class="main">
    <post title="My first blog post">
      <v-p>Hello there</v-p>
      <v-p>This is an example of a componentized blog post</v-p>
    </post>

    <v-hr/>

    <post title="My second blog post">
      <v-p>Hello there</v-p>
      <v-p>This is another example.</v-p>
      <v-p>Wa-hoo!</v-p>
    </post>

    <v-hr/>

    <post title="The final blog post">
      <v-p>C'est la fin !</v-p>
    </post>
  </div>
</template>

<script>
import Post from '~/components/post'
import vP from '~/components/paragraph'
const vHr = { render: (h) => h('hr', { class: 'hr' }) }

export default {
  components: {
    Post,
    vP,
    vHr
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
