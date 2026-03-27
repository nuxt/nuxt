<script setup lang="ts">
// const weather = await $fetch<{ current_weather: { temperature: number } }>(
//   'https://api.open-meteo.com/v1/forecast?latitude=33.45&longitude=-112.07&current_weather=true&temperature_unit=fahrenheit',
// )
//
// const title = `Phoenix: ${weather.current_weather.temperature}°F`
// definePageMeta({
//   title,
// })

const { data: title } = await useAsyncData('title', async () => {
  console.log('hey', 'fetching...')
  const weather = await $fetch<{ current_weather: { temperature: number } }>(
    'https://api.open-meteo.com/v1/forecast?latitude=33.45&longitude=-112.07&current_weather=true&temperature_unit=fahrenheit', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
  )
  // const weather = await fetch(
  //   'https://api.open-meteo.com/v1/forecast?latitude=33.45&longitude=-112.07&current_weather=true&temperature_unit=fahrenheit',
  // ).then((res) => {
  //   return res.json() as Promise<{ current_weather: { temperature: number } }>
  // }).catch((err) => {
  //   console.error(err)
  // })

  console.log('hey', weather)

  return `Phoenix: ${weather.current_weather.temperature}°F`
})

useHead({
  title,
})
</script>

<template>
  <div>
    <NuxtLink to="/">Back</NuxtLink>
    <h1>{{ title }}</h1>
  </div>
</template>
