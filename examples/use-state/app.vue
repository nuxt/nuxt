<template>
  <div>
    Locale: {{ locale }}
    <button @click="updateLocale">
      Set to Klington
    </button>
  </div>
</template>

<script setup>
// Defined in composables/stats.ts
// same as useState('locale')
const locale = useLocale()
const updateLocale = () => { locale.value = 'tlh-klingon' }
</script>
