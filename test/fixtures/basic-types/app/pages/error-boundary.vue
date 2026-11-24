<template>
  <div>
    <NuxtErrorBoundary>
      <template #default>
        <p>default</p>
      </template>
      <template #error="{ error, clearBoundaryError }">
        <template v-if="false">
          {{ (true satisfies IsEqual<(typeof error)['status'], number | undefined>) }}
          {{ (true satisfies IsEqual<(typeof error)['statusText'], string | undefined>) }}
          {{ (true satisfies IsEqual<(typeof error)['data'], unknown>) }}
          {{ (true satisfies IsEqual<(typeof error)['cause'], unknown>) }}
          {{ (true satisfies IsEqual<(typeof error)['fatal'], boolean | undefined>) }}
          {{ (true satisfies (Error extends typeof error ? true : false)) }}
        </template>
        <p>{{ error.status }} {{ error.statusText }} {{ error.message }}</p>
        <button @click="clearBoundaryError()">
          clear
        </button>
      </template>
    </NuxtErrorBoundary>
  </div>
</template>
