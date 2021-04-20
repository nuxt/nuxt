import unified from 'unified'
import remarkParse from 'remark-parse'
import remark2rehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import rehypeRaw from 'rehype-raw'
import { readAsset } from '#assets'

export default async (req) => {
  const markdown = unified()
    .use(remarkParse)
    .use(remark2rehype)
    .use(rehypeRaw)
    .use(rehypeStringify)

  const id = req.url

  const data = await readAsset(`content${id}`) || `content not found: ${id}`

  if ((id as string).endsWith('.md')) {
    return {
      html: await markdown.process({ contents: data }).then(v => v.toString())
    }
  }

  return data
}
