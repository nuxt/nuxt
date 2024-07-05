import { template } from 'lodash-es';
import { readFileSync } from 'node:fs';
addTemplate({
    fileName: 'appinsights-vue.js',

    options: {
        /* some options */
    },

    getContents({ options: options }) {
        const contents = readFileSync(resolver.resolve('./runtime/plugin.ejs'), 'utf-8');

        return template(contents)({
            options: options,
        });
    },
});
