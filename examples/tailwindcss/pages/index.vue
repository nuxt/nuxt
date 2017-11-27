<template>
  <div>
    <div class="max-w-sm mt-4 rounded overflow-hidden shadow-lg">
      <img class="w-full" src="https://tailwindcss.com/img/card-top.jpg">
      <div class="px-6 py-4">
        <div class="font-bold text-xl mb-2">The Coldest Sunset</div>
        <p class="text-slate text-base">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptatibus quia, nulla! Maiores et perferendis eaque, exercitationem praesentium nihil.</p>
      </div>
      <div class="px-6 py-4">
        <span class="inline-block bg-grey-lighter rounded-full px-3 py-1 text-sm font-semibold text-slate mr-2">#photography</span>
        <span class="inline-block bg-grey-lighter rounded-full px-3 py-1 text-sm font-semibold text-slate mr-2">#travel</span>
        <span class="inline-block bg-grey-lighter rounded-full px-3 py-1 text-sm font-semibold text-slate">#winter</span>
      </div>
    </div>
    <button @click="$router.push('/about')" class="bg-blue mt-4 hover:bg-blue-dark text-white font-bold py-2 px-4 rounded">About</button>
  </div>
</template>
