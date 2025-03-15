import type { Code } from '@vue/language-core'

export function augmentVlsCtx (content: Code[], getCodes: () => ` & ${string}`) {
  let from = -1
  let to = -1

  for (let i = 0; i < content.length; i++) {
    const code = content[i]

    if (typeof code !== 'string') {
      continue
    }

    if (from === -1 && code.startsWith(`const __VLS_ctx`)) {
      from = i
    } else if (from !== -1 && code === `;\n`) {
      to = i
      break
    }
  }

  if (to === -1) {
    return
  }

  content.splice(to, 0, ...getCodes())
}
