import type { RequestEvent } from 'nuxt/schema'

import { createError, getQuery, isNuxtError, readBody } from './index'
import type { NuxtErrorDetails } from '../app/error'

/** A validation failure, as a Standard Schema reports it. */
interface ValidationIssue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
}

type StandardResult<Output> = { readonly value: Output, readonly issues?: undefined } | { readonly issues: ReadonlyArray<ValidationIssue> }

/** A schema implementing [Standard Schema](https://standardschema.dev), as Zod, Valibot and ArkType do. */
interface StandardSchema<Output = unknown> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>
    readonly types?: { readonly input: unknown, readonly output: Output } | undefined
  }
}

type SchemaOutput<S extends StandardSchema> = NonNullable<S['~standard']['types']>['output']

/**
 * What a validator function returns: the validated value, `true` to accept
 * the input as it is, or `false` to reject it. Returning nothing accepts the
 * input, and throwing rejects it with the error thrown.
 *
 * @since 4.6.0
 */
export type ValidateResult<T> = T | true | false | void

type Validator<Input, Output> = StandardSchema<Output> | ((data: Input) => ValidateResult<Output> | Promise<ValidateResult<Output>>)

interface ValidateOptions {
  /** The error to reject invalid input with, in place of a `400` carrying the issues as `data.issues`. */
  onError?: (result: { issues: ReadonlyArray<ValidationIssue> }) => NuxtErrorDetails
}

const VALIDATION_FAILED = 'Validation failed'

async function validateData<Output> (data: unknown, validate: Validator<unknown, Output>, options?: ValidateOptions): Promise<Output> {
  if ('~standard' in validate) {
    const result = await validate['~standard'].validate(data)
    if (result.issues) {
      throw createValidationError(options?.onError?.(result) || { message: VALIDATION_FAILED, issues: result.issues })
    }
    return result.value
  }
  try {
    const result = await validate(data)
    if (result === false) {
      throw createValidationError(options?.onError?.({ issues: [{ message: VALIDATION_FAILED }] }) || { message: VALIDATION_FAILED })
    }
    return (result === true ? data : result ?? data) as Output
  } catch (error) {
    throw createValidationError(error)
  }
}

function createValidationError (cause: unknown) {
  if (isNuxtError(cause)) {
    return cause
  }
  const details = cause as (NuxtErrorDetails & { issues?: unknown }) | undefined
  return createError({
    cause,
    status: details?.status || 400,
    statusText: details?.statusText || VALIDATION_FAILED,
    message: details?.message || VALIDATION_FAILED,
    data: {
      issues: details?.issues,
      message: cause instanceof Error ? VALIDATION_FAILED : details?.message || VALIDATION_FAILED,
    },
  })
}

/**
 * Read the query string of the request, validated with a Standard Schema or a
 * validator function. Invalid input is rejected with a `400` whose `data`
 * carries the issues, unless `onError` returns a different error.
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 *
 * export default defineEventHandler(async (event) => {
 *   const { page } = await getValidatedQuery(event, z.object({ page: z.coerce.number() }))
 *   return { page }
 * })
 * ```
 *
 * @since 4.6.0
 */
export function getValidatedQuery<S extends StandardSchema> (event: Pick<RequestEvent, 'req'> & { url?: URL }, validate: S, options?: ValidateOptions): Promise<SchemaOutput<S>>
export function getValidatedQuery<Output> (event: Pick<RequestEvent, 'req'> & { url?: URL }, validate: (data: Record<string, string | string[]>) => ValidateResult<Output> | Promise<ValidateResult<Output>>, options?: ValidateOptions): Promise<Output>
export function getValidatedQuery (event: Pick<RequestEvent, 'req'> & { url?: URL }, validate: Validator<any, unknown>, options?: ValidateOptions): Promise<unknown> {
  return validateData(getQuery(event), validate, options)
}

/**
 * Read and parse the request body as {@link readBody} does, validated with a
 * Standard Schema or a validator function. Invalid input is rejected with a
 * `400` whose `data` carries the issues, unless `onError` returns a different
 * error.
 *
 * @since 4.6.0
 */
export function readValidatedBody<S extends StandardSchema> (event: Pick<RequestEvent, 'req'>, validate: S, options?: ValidateOptions): Promise<SchemaOutput<S>>
export function readValidatedBody<Output> (event: Pick<RequestEvent, 'req'>, validate: (data: unknown) => ValidateResult<Output> | Promise<ValidateResult<Output>>, options?: ValidateOptions): Promise<Output>
export async function readValidatedBody (event: Pick<RequestEvent, 'req'>, validate: Validator<any, unknown>, options?: ValidateOptions): Promise<unknown> {
  return validateData(await readBody(event), validate, options)
}
