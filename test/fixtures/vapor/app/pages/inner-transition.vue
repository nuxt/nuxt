<script setup lang="ts" vapor>
const showIf = ref(true)
const showShow = ref(true)
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Inner transition
    </h1>
    <button
      data-testid="toggle-if"
      @click="showIf = !showIf"
    >
      toggle v-if
    </button>
    <button
      data-testid="toggle-show"
      @click="showShow = !showShow"
    >
      toggle v-show
    </button>
    <Transition name="fade">
      <p
        v-if="showIf"
        data-testid="if-target"
      >
        v-if content
      </p>
    </Transition>
    <Transition name="fade">
      <p
        v-show="showShow"
        data-testid="show-target"
      >
        v-show content
      </p>
    </Transition>
  </div>
</template>
