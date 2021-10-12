<template>
  <div>
    Locale: {{ locale }}
    <button @click="updateLocale">
      Set to Klington
    </button>
  </div>
</template>

<script setup>
const locale = useState('locale')
const updateLocale = () => { locale.value = 'tlh-klingon' }
</script>
