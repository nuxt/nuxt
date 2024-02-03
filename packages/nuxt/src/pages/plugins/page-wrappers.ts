import { createUnplugin } from "unplugin";
import { genImport } from "knitwork";
import type { ParsedQuery} from 'ufo';
import { getQuery, withQuery } from 'ufo'

export const pageWrappersQueryKey = '_wrappers'

const createClientOnlyName = 'createClientOnly'
const createClientOnlyImport = genImport('#app/components/client-only', [createClientOnlyName])
const pageVarName = 'Page';
const vueImports = genImport('vue', ['h', 'defineComponent', 'createBlock', 'createVNode'])

export const PageWrappersPlugin = createUnplugin(() => {
  return {
    name: 'nuxt:page-wrappers',

    transformInclude(id) {
      return hasWrapperQuery(id)
    },

    transform(code, id) {
      const originalUrl = withoutWrapperQueryParam(id);
      const pageImport = genImport(originalUrl, pageVarName);

      return [
        vueImports,
        createClientOnlyImport,
        pageImport,
        `const WrappedPage = ${createClientOnlyName}(${pageVarName});`,
        // this also renders page on the server
        // 'export default defineComponent(() => () => h(WrappedPage, null, null))'
        // 'export default WrappedPage;'

        // all of this though does not render the page at all
        // 'export default defineComponent(() => () => h("div", null, WrappedPage))'
        // 'export default defineComponent(() => {',
        // '  return () => h(\'div\', null, () => WrappedPage)',
        // '});'
        'export default defineComponent({',
        '  setup() {',
        '    return () => h("div", null, WrappedPage)',
        '  }',
        '})',
      ].join('\n')
    },
  }
})

const queryCache = new Map<string, ParsedQuery>();

function getCachedQuery(id: string) {
  let query: ParsedQuery;

  if (queryCache.has(id)) {
    query = queryCache.get(id)!
  } else {
    query = getQuery(id);
    queryCache.set(id, query)
  }

  return query
}

function hasWrapperQuery(id: string): boolean {
  const query = getCachedQuery(id);

  return query[pageWrappersQueryKey] !== undefined
}

function withoutWrapperQueryParam(id: string) {
  const existingQuery = getCachedQuery(id);
  const idWithoutQuery = id.split('?')[0];

  return withQuery(
    idWithoutQuery,
    {
      ...existingQuery,
      [pageWrappersQueryKey]: undefined
    }
  )
}
