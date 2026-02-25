<template>
  <div>
    async setup
    <NuxtClientFallback>
      <BreakInAsyncSetup class="clientfallback-async-setup" />
      <template #fallback>
        <div>Work with async setup</div>
      </template>
    </NuxtClientFallback>
  </div>
</template>
