<template>
  <div>
    <p>
      <button @click="$store.commit('increment')">{{ $store.state.counter }}</button><br>
      <router-link to="/">Home</router-link>
    </p>
  </div>
</template>
