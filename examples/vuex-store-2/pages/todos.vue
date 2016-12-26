<template>
  <div>
    <h2>Todos</h2>
    <input placeholder="What needs to be done?" @keyup.enter="addTodo">
    <ul>
      <li v-for="todo in todos">
        <input type="checkbox" :checked="todo.done" @change="toggle({ todo })">
        <label v-text="todo.text" @dblclick="editing = true"></label>
      </li>
    </ul>
    <nuxt-link to="/">Home</nuxt-link>
  </div>
</template>

<script>
import { mapMutations } from 'vuex'

export default {
  computed: {
    todos () { return this.$store.state.todos.list }
  },
  methods: {
    addTodo (e) {
      var text = e.target.value
      if (text.trim()) {
        this.$store.commit('todos/add', { text })
      }
      e.target.value = ''
    },
    ...mapMutations({
      toggle: 'todos/toggle'
    })
  }
}
</script>

<style>
li {
  list-style: none;
}
</style>
