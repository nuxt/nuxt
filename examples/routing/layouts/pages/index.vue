<template>
  <NuxtExampleLayout example="routing/layouts">
    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/default">
          Default layout
        </NuxtLink>
        <NuxtLink to="/custom">
          Custom layout
        </NuxtLink>
        <NuxtLink to="/dynamic">
          Dynamic layout
        </NuxtLink>
        <NuxtLink to="/other">
          Other layout
        </NuxtLink>
        <NButton @click="setPageLayout('default')">
          Change to default layout
        </NButton>
        <NButton @click="setPageLayout('custom')">
          Change to custom layout
        </NButton>
        <NButton @click="setPageLayout('other')">
          Change to other layout
        </NButton>
      </nav>
    </template>
  </NuxtExampleLayout>
</template>
