const { readFile, writeFile } = require('node:fs/promises')

const netlifyToVercel = (redirects) => {
  return JSON.stringify(
    {
      redirects: redirects.split('\n')
        .filter(s => s !== '' && !s.startsWith('#'))
        .map((line) => {
          const [source, destination] = line.split(' /')
          return {
            source: source.replace('*', ':path').trim(),
            destination: `/${destination.replace(' 302!', '').replace(':splat', ':path').trim()}`,
            permanent: false
          }
        })
    }, null, 2)
}

async function transformRedirects () {
  try {
    const redirectsFile = await readFile('../public/_redirects', 'utf-8')
    const vercelConfig = netlifyToVercel(redirectsFile)
    console.log(vercelConfig)
    await writeFile('../public/vercel.json', vercelConfig)
  } catch (e) {
    console.error(e)
  }
}

transformRedirects()
