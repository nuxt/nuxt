<script setup lang="ts">
const key = ''

const { data } = useAsyncData(key, async () => $fetch<{ current_weather: { temperature: number } }>(
  'https://api.open-meteo.com/v1/forecast?latitude=33.45&longitude=-112.07&current_weather=true&temperature_unit=fahrenheit'))

</script>

<template>
  <div>
    <NuxtLink to="/">Back</NuxtLink>
    <h1>{{ data }}</h1>
  </div>
</template>
