<script setup lang="ts">
defineProps<{ rating: { score: number, count: number } }>()
</script>

<template>
  <div class="rating">
    <span
      v-for="star in 5"
      :key="star"
      :class="{ filled: star <= rating.score }"
    >*</span>
    <small>({{ rating.count }})</small>
  </div>
</template>
