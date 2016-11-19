<template>
  <div id="__nuxt">
    <slot></slot>
  </div>
</template>

<script>
export default {
  name: 'nuxt-container',
  head: <%= JSON.stringify(head) %>
}
</script>

<% css.forEach(function (c) { %>
<style src="<%= (typeof c === 'string' ? c : c.src) %>" lang="<%= (c.lang ? c.lang : 'css') %>"></style>
<% }) %>
