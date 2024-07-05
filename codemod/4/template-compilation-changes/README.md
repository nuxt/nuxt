This codemod removes lodash/template and related template utilities from Nuxt in favor of a more flexible and secure getContents() function for code generation in v3.

### What Changed

Previously, Nuxt used `lodash/template` to compile templates located on the file system using the `.ejs` file format/syntax. Additionally, Nuxt provided some template utilities (`serialize`, `importName`, `importSources`) for code generation within these templates. These utilities are now being removed.

### Reasons for Change

In Nuxt v3, we moved to a 'virtual' syntax with a `getContents()` function, which is much more flexible and performant. Additionally, `lodash/template` has had multiple security issues. Although these issues do not apply to Nuxt projects since it is used at build-time and by trusted code, they still appear in security audits. Moreover, `lodash` is a hefty dependency and is unused by most projects.

### Before

```js
addTemplate({
    fileName: 'appinsights-vue.js',
    options: {
        /* some options */
    },
    src: resolver.resolve('./runtime/plugin.ejs'),
});
```

### After

```js
import { template } from 'lodash-es';
import { readFileSync } from 'node:fs';

addTemplate({
    fileName: 'appinsights-vue.js',
    options: {
        /* some options */
    },
    getContents({ options }) {
        const contents = readFileSync(resolver.resolve('./runtime/plugin.ejs'), 'utf-8');
        return template(contents)({ options });
    },
});
```


> This change applies to all templates using .ejs file format/syntax.
