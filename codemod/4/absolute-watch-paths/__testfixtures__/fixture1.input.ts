// biome-ignore lint/correctness/useHookAtTopLevel: <explanation>
nuxt.hook('builder:watch', (event, path) => {
    someFunction();
});

nuxt.hook('builder:watch', async (event, key) =>
    console.log('File changed:', path),
);
