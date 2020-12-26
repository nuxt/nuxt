<template>
  <footer>
    <h2>This is the footer</h2>
    <p>count: {{ $store.state.counter }}</p>
    <button @click="$store.commit('increment')">
      Increment
    </button>
  </footer>
</template>

<style scoped>
footer {
  background-color: #eee;
}
</style>
