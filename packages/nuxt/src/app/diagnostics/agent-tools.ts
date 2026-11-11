import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, prodReporters, reporters } from './_shared'

/**
 * E9xxx
 * Agent tool (WebMCP) runtime diagnostics.
 */
export const agentToolDiagnostics = !import.meta.dev
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase, reporters: prodReporters })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E9001: {
          why: (p: { tool: string }) => `The browser rejected the agent tool \`${p.tool}\`.`,
          fix: 'Tool names may only contain letters, digits, `_`, `-` and `.`, and must be unique on the page, including tools registered by other scripts.',
          docs: false,
        },
        NUXT_E9002: {
          why: (p: { tool: string }) => `The agent tool \`${p.tool}\` is defined more than once with different descriptions, so only the first is used.`,
          fix: 'Give each tool its own name, or share one `defineAgentTool()` definition between the components that use it.',
          docs: false,
        },
        NUXT_E9003: {
          why: (p: { tool: string, problems: string[] }) => `The agent tool \`${p.tool}\` does not follow the tool design guidance: ${p.problems.join('; ')}.`,
          fix: 'Keep names under 30 characters, descriptions under 500 and parameter descriptions under 150, so agents can choose between tools without filling their context.',
          docs: false,
        },
        NUXT_E9004: {
          why: (p: { tool: string, length: number }) => `The agent tool \`${p.tool}\` returned ${p.length} characters.`,
          fix: 'Keep results under 1,500 characters by summarising them or returning a page at a time, so they fit in the agent\'s context.',
          docs: false,
        },
      },
    })
