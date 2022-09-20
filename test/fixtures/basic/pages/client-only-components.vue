<template>
  <div>
    <ClientOnlyScript class="client-only-script" foo="bar" />
    <ClientOnlySetupScript class="client-only-script-setup" foo="hello">
      <template #test>
        <div class="slot-test">
          Hello
        </div>
      </template>
    </ClientOnlySetupScript>
    <ClientOnly>
      Should not be server rendered.
      <template #fallback>
        <div>Fallback</div>
      </template>
    </ClientOnly>
  </div>
</template>
