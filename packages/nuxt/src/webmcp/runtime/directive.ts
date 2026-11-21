import type { ObjectDirective } from 'vue'
import { nextTick, toRaw } from 'vue'
import type { AgentToolDefinition, AgentToolRegistry } from './registry'
import { formatIssues, isStandardSchema, text, toJsonSchema } from './registry'
import type { FormFields } from './dom'
import { describeSchema, fillFields, formOf, formSchema, highlight, isDisabled, itemLabel, labelOf, mergeInput, nativeProblems, readFields, submitterOf } from './dom'

/** Compiled from a template binding of a `@tool` function. */
export interface AgentToolBinding {
  name: string
  kind: 'action' | 'form'
  description: string
  readonly: boolean
  consequential: boolean
  confirm: boolean
  target?: unknown
  invoke: (event: unknown) => unknown
  enabled?: () => boolean
  fields?: FormFields
  /** The object every field belongs to, validated as a whole. */
  root?: () => unknown
  schema?: () => unknown
}

/** Connects `requestSubmit()` from a tool call to the result of the compiled submit handler. */
export function createSubmitCapture () {
  const pending = new Map<string, { resolve: (result: unknown) => void, reject: (error: unknown) => void }>()
  return {
    capture (name: string, run: () => unknown) {
      const call = pending.get(name)
      pending.delete(name)
      try {
        const result = run()
        call?.resolve(result)
        return result
      } catch (error) {
        call?.reject(error)
        throw error
      }
    },
    wait (name: string, timeout = 5000) {
      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(name)
          reject(new Error('The form did not submit. It may be showing validation errors.'))
        }, timeout)
        pending.set(name, {
          resolve: (result) => {
            clearTimeout(timer)
            resolve(result)
          },
          reject: (error) => {
            clearTimeout(timer)
            reject(error)
          },
        })
      })
    },
  }
}

export type SubmitCapture = ReturnType<typeof createSubmitCapture>

export function createAgentToolDirective (registry: AgentToolRegistry, submits: SubmitCapture): ObjectDirective<HTMLElement, AgentToolBinding | AgentToolBinding[]> {
  const definitions = new Map<string, AgentToolDefinition>()
  const state = new WeakMap<HTMLElement, { binding: AgentToolBinding, dispose: () => void }[]>()
  const toArray = (value: AgentToolBinding | AgentToolBinding[]) => Array.isArray(value) ? value : [value]

  function definitionFor (binding: AgentToolBinding, el: HTMLElement): AgentToolDefinition {
    const form = binding.kind === 'form' ? formOf(el) ?? el : undefined
    const create = (): AgentToolDefinition => {
      let inputSchema
      if (form) {
        const schema = binding.schema?.()
        const json = isStandardSchema(schema) ? toJsonSchema(schema) : undefined
        inputSchema = json ? describeSchema(json, binding.fields ?? {}, form) : formSchema(binding.fields ?? {}, form)
      }
      return {
        name: binding.name,
        description: binding.description || (form ? `Submit the "${labelOf(form.querySelector('legend, h1, h2, h3') ?? form)}" form.` : `Activate "${labelOf(el)}".`),
        inputSchema,
        annotations: { readOnlyHint: binding.readonly, consequentialHint: binding.consequential },
        confirm: binding.confirm,
      }
    }
    // a form's schema depends on its current values, so it is read each time the form mounts
    if (form) {
      return create()
    }
    const key = JSON.stringify([binding.name, binding.description, binding.readonly, binding.consequential, binding.confirm])
    let definition = definitions.get(key)
    if (!definition) {
      definitions.set(key, definition = create())
    }
    return definition
  }

  async function fill (binding: AgentToolBinding, el: HTMLElement, input: Record<string, unknown>, signal: AbortSignal) {
    const fields = binding.fields ?? {}
    const schema = binding.schema?.()
    if (isStandardSchema(schema)) {
      const current = binding.root ? toRaw(binding.root()) : readFields(fields)
      const result = await schema['~standard'].validate(mergeInput(current, input))
      if (result.issues) {
        return text(`The form was not submitted. ${formatIssues(result.issues)}`, true)
      }
      if (signal.aborted) {
        return
      }
    }
    const previous = Object.values(fields).map(field => field.get())
    const problems = fillFields(fields, input)
    await nextTick()
    const form = formOf(el)
    if (!problems.length && form) {
      problems.push(...nativeProblems(fields, form))
      const submitter = submitterOf(form)
      if (!problems.length && !binding.confirm && submitter && isDisabled(submitter)) {
        problems.push('The submit button is disabled.')
      }
    }
    if (problems.length || signal.aborted) {
      Object.values(fields).forEach((field, i) => field.set(previous[i]))
      return problems.length ? text(`The form was not submitted. ${problems.join('; ')}`, true) : undefined
    }
  }

  function submit (binding: AgentToolBinding, el: HTMLElement) {
    const form = formOf(el)
    if (form instanceof HTMLFormElement) {
      const result = submits.wait(binding.name)
      form.requestSubmit(submitterOf(form) ?? undefined)
      return result
    }
    return binding.invoke(new Event('submit', { cancelable: true }))
  }

  function activate (el: HTMLElement, value: AgentToolBinding) {
    const current = { binding: value, dispose: () => {} }
    const isForm = value.kind === 'form'
    current.dispose = registry.activate(definitionFor(value, el), {
      enabled: () => el.isConnected && (current.binding.enabled?.() ?? true) && !isDisabled(el),
      targets: 'target' in value
        ? () => el.isConnected ? [{ key: String(current.binding.target), label: itemLabel(el), element: el }] : []
        : undefined,
      element: () => el,
      prepare: isForm ? (input, ctx) => fill(current.binding, el, input as Record<string, unknown>, ctx.signal) : undefined,
      stage: () => {
        if (isForm) {
          const form = formOf(el) ?? el
          const submitter = submitterOf(form)
          highlight(submitter ? [form, submitter] : [form])
          submitter?.focus({ preventScroll: true })
          return 'Filled in the form. The user needs to review and submit it.'
        }
        el.focus({ preventScroll: true })
        return `Highlighted "${labelOf(el)}". The user needs to click it.`
      },
      execute: () => isForm
        ? submit(current.binding, el)
        : current.binding.invoke(new MouseEvent('click', { bubbles: true, cancelable: true })),
    }).dispose
    return current
  }

  return {
    mounted (el, { value }) {
      state.set(el, toArray(value).map(binding => activate(el, binding)))
    },
    updated (el, { value }) {
      const bindings = toArray(value)
      state.get(el)?.forEach((current, i) => {
        current.binding = bindings[i] ?? current.binding
      })
    },
    beforeUnmount (el) {
      state.get(el)?.forEach(current => current.dispose())
      state.delete(el)
    },
  }
}
