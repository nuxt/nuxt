import path from 'path'
// fs-extra는 fs에 없는 몇 파일 시스템 메소드를 추가하고, promise도 추가 됨
import fs from 'fs-extra'
import * as imports from '../imports'

async function registerTSNode({ tsConfigPath, options }) {
  const { register } = await imports.tsNode()

  // 타입스크립트를 node가 실행할 수 있게 함
  // https://github.com/TypeStrong/ts-node
  register({
    project: tsConfigPath,
    compilerOptions: {
      module: 'commonjs'
    },
    ...options
  })
}

async function getNuxtTypeScript() {
  try {
    return await imports.nuxtTypescript() // '@nuxt/typescript' 가져옴
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw (error)
    }
  }
}

export async function detectTypeScript(rootDir, options = {}) {
  const typescript = {
    // 전달받은 rootDir에서부터 tsconfig.son까지의 절대 경로
    // tsconfig.json이 있다면, 그 위치가 타입스크립트 프로젝트의 루트임을 의미함
    tsConfigPath: path.resolve(rootDir, 'tsconfig.json'),
    tsConfigExists: false,
    runtime: false,
    build: false,
    options
  }

  // Check if tsconfig.json exists
  typescript.tsConfigExists = await fs.exists(typescript.tsConfigPath)

  // Skip if tsconfig.json not exists
  // tsconfig 파일이 없다면 기타 옵션들 false인 채로 리턴함
  if (!typescript.tsConfigExists) {
    return typescript
  }

  // Register runtime support
  // typescript를 node가 실행할 수 있게 하는 ts-node 모듈
  typescript.runtime = true
  await registerTSNode(typescript)

  // Try to load @nuxt/typescript, nuxt와 typescript integeration 하는 모듈
  const nuxtTypeScript = await getNuxtTypeScript()

  // If 넉스트타입스트립트 모듈 exists do additional setup
  if (nuxtTypeScript) {
    typescript.build = true
    await nuxtTypeScript.setupDefaults(typescript.tsConfigPath)
  }

  return typescript
}
