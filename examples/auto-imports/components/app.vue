<template>
  <NuxtExampleLayout example="auto-imports/components">
    <h1 class="text-xl opacity-50">
      Auto Imported Components
    </h1>
    <div>
      <!-- Auto Imported Components -->
      <HelloWorld class="text-2xl" />
      <Nuxt3 class="text-2xl" />
      <ParentFolderHello class="mt-6" />
      <ClientAndServer style="color: red">
        <div>[Slot]</div>
      </ClientAndServer>
      <JustClient />
      <NuxtWithPrefix class="mt-6" />
    </div>
  </NuxtExampleLayout>
</template>
