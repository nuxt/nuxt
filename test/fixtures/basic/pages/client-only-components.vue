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
  </div>
</template>
