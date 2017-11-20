<template>
  <div>
    <h2>Todos</h2>
    <ul>
      <li v-for="todo in todos">
        <input type="checkbox" :checked="todo.done" @change="toggle(todo)">
        <span :class="{ done: todo.done }">{{ todo.text }}</span>
      </li>
      <li><input placeholder="What needs to be done?" @keyup.enter="addTodo"></li>
    </ul>
    <nuxt-link to="/">Home</nuxt-link>
  </div>
</template>

<script>
import { mapMutations, mapGetters } from 'vuex'

export default {
  computed: mapGetters({
    todos: 'todos/todos'
  }),
  methods: {
    addTodo(e) {
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
.done {
  text-decoration: line-through;
}
</style>
