<script setup lang="ts">
const locale = ref()
const switchLocale = () => {
  locale.value = locale.value !== 'fr' ? 'fr' : 'en-GB'
}
const date = ref(new Date('2023-02-11T08:24:08.396Z').valueOf())
const changeDate = () => {
  date.value = Date.now()
}
</script>

<template>
  <div>
    <NuxtTime
      :locale="locale"
      data-testid="switchable"
      :datetime="date"
      second="numeric"
      month="long"
      day="numeric"
    />
    <br>
    <NuxtTime
      :locale="locale"
      data-testid="present"
      :datetime="new Date()"
      second="numeric"
      month="long"
      day="numeric"
    />
    <br>
    <NuxtTime
      :locale="locale"
      data-testid="fixed"
      datetime="2023-02-11T08:24:08.396Z"
      month="long"
      day="numeric"
    />
    <br>
    <NuxtTime
      datetime="2023-08-19T02:57:00.000Z"
      time-zone="America/New_York"
    />
    <br>
    <NuxtTime
      data-testid="relative"
      :datetime="Date.now() - (1 * 30 * 1000)"
      relative
    />
    <br>
    <button @click="switchLocale">
      Switch locale
    </button>
    <br>
    <button @click="changeDate">
      Update time
    </button>
  </div>
</template>
