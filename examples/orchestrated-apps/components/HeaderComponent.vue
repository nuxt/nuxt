<template>
  <header>
    <h2>This is the header</h2>
    <p>count: {{ $store.state.counter }}</p>
    <button @click="$store.commit('increment')">
      Increment
    </button>
  </header>
</template>

<style scoped>
header {
  background-color: #eee;
}
</style>
