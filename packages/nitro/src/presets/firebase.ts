import { createRequire } from 'module'
import { join, relative, resolve } from 'pathe'
import fse from 'fs-extra'
import { globby } from 'globby'
import { readPackageJSON } from 'pkg-types'
import { writeFile } from '../utils'
import { NitroPreset, NitroContext } from '../context'

export const firebase: NitroPreset = {
  entry: '{{ _internal.runtimeDir }}/entries/firebase',
  externals: true,
  commands: {
    deploy: 'npx firebase deploy'
  },
  hooks: {
    async 'nitro:compiled' (ctx: NitroContext) {
      await writeRoutes(ctx)
    }
  }
}

async function writeRoutes ({ output: { publicDir, serverDir }, _nuxt: { rootDir, modulesDir } }: NitroContext) {
  if (!fse.existsSync(join(rootDir, 'firebase.json'))) {
    const firebase = {
      functions: {
        source: relative(rootDir, serverDir)
      },
      hosting: [
        {
          site: '<your_project_id>',
          public: relative(rootDir, publicDir),
          cleanUrls: true,
          rewrites: [
            {
              source: '**',
              function: 'server'
            }
          ]
        }
      ]
    }
    await writeFile(resolve(rootDir, 'firebase.json'), JSON.stringify(firebase))
  }

  const _require = createRequire(import.meta.url)

  const jsons = await globby(`${serverDir}/node_modules/**/package.json`)
  const prefixLength = `${serverDir}/node_modules/`.length
  const suffixLength = '/package.json'.length
  const dependencies = jsons.reduce((obj, packageJson) => {
    const dirname = packageJson.slice(prefixLength, -suffixLength)
    if (!dirname.includes('node_modules')) {
      obj[dirname] = _require(packageJson).version
    }
    return obj
  }, {} as Record<string, string>)

  let nodeVersion = '14'
  try {
    const currentNodeVersion = fse.readJSONSync(join(rootDir, 'package.json')).engines.node
    if (['16', '14'].includes(currentNodeVersion)) {
      nodeVersion = currentNodeVersion
    }
  } catch {}

  const getPackageVersion = async (id) => {
    const pkg = await readPackageJSON(id, { url: modulesDir })
    return pkg.version
  }

  await writeFile(
    resolve(serverDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        main: './index.mjs',
        dependencies,
        devDependencies: {
          'firebase-functions-test': 'latest',
          'firebase-admin': await getPackageVersion('firebase-admin'),
          'firebase-functions': await getPackageVersion('firebase-functions')
        },
        engines: { node: nodeVersion }
      },
      null,
      2
    )
  )
}
