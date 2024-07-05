// biome-ignore lint/correctness/useHookAtTopLevel: <explanation>
import { relative, resolve } from 'node:fs';

nuxt.hook('builder:watch', (event, path) => {
    path = relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, path));
    someFunction()
});


nuxt.hook('builder:watch', async (event, key) => {
    key = relative(nuxt.options.srcDir, resolve(nuxt.options.srcDir, key));
    return console.log('File changed:', path);
});

