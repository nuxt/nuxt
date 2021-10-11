<template>
  <div class="overflow-hidden relative mx-auto max-w-8xl">
    <HeroParallax />
    <div class="flex flex-wrap justify-center py-0 section">
      <section class="flex flex-col justify-start w-full px-4 pt-36 pb-52 md:pt-40 lg:pb-56 lg:pt-48 text-center">
        <div>
          <span class="nuxt-text-highlight">Currently in public beta</span>
        </div>
        <h1 class="font-normal font-serif text-display-5 xs:text-display-4 md:text-display-3 2xl:text-display-2 my-8">
          <Markdown use="title" unwrap="p" />
        </h1>
        <h2
          class="
            font-normal
            text-body-base
            xs:text-body-lg
            md:text-body-xl
            2xl:text-body-2xl
            px-8
            sm:px-0
            text-secondary-dark
            dark:text-cloud-lighter
          "
        >
          <Markdown use="description" unwrap="p" />
        </h2>
        <p class="text-center mt-2 text-secondary-dark dark:text-cloud-lighter">
          <Markdown use="body" unwrap="p" />
        </p>
      </section>
    </div>
  </div>
</template>
