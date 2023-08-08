<template>
    <div>{{error.message}}</div>
    <div>{{error.details}}</div>
  </template>
  
  <script setup>
  const props = defineProps({
    error: Object
  })
  
  console.log(props.error)
  </script>