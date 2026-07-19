<template>
  <div>
    <div>myPlugin: {{ $myPlugin() }}</div>
    <div>asyncPlugin: {{ $asyncPlugin() }}</div>
    <div>dependsOnPlugin: {{ $dependsOnPlugin() }}</div>
  </div>
</template>
