import type { ZodError, ZodIssue } from "zod"

/**
 * Structured error codes for better error handling
 */
export enum ValidationErrorCode {
  INVALID_JOB_NAME = "INVALID_JOB_NAME",
  INVALID_TEMPLATE_NAME = "INVALID_TEMPLATE_NAME",
  MISSING_EXTENDS_TARGET = "MISSING_EXTENDS_TARGET",
  CIRCULAR_EXTENDS = "CIRCULAR_EXTENDS",
  INVALID_STAGE = "INVALID_STAGE",
  INVALID_SCRIPT = "INVALID_SCRIPT",
  RESERVED_KEY = "RESERVED_KEY",
  SCHEMA_VALIDATION = "SCHEMA_VALIDATION",
}

/**
 * Structured validation error
 */
export interface ValidationError {
  code: ValidationErrorCode | string
  message: string
  path?: (string | number)[]
  details?: Record<string, unknown>
}

/**
 * Format Zod errors to structured ValidationError objects
 */
export function formatZodError(error: ZodError): ValidationError[] {
  return error.issues.map((err: ZodIssue) => ({
    code: ValidationErrorCode.SCHEMA_VALIDATION,
    message: err.message,
    path: err.path.filter(
      (p): p is string | number => typeof p === "string" || typeof p === "number",
    ),
    details: {
      zodCode: err.code,
      expected: "expected" in err ? err.expected : undefined,
      received: "received" in err ? err.received : undefined,
    },
  }))
}

/**
 * Create a validation error
 */
export function createValidationError(
  code: ValidationErrorCode | string,
  message: string,
  path?: (string | number)[],
  details?: Record<string, unknown>,
): ValidationError {
  return { code, message, path, details }
}

/**
 * Validation result with errors and warnings
 */
export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors: ValidationError[]
  warnings: ValidationError[]
  metadata: {
    skippedChecks: string[]
  }
}

/**
 * Create a successful validation result
 */
export function createSuccessResult<T>(
  data: T,
  warnings: ValidationError[] = [],
  skippedChecks: string[] = [],
): ValidationResult<T> {
  return {
    success: true,
    data,
    errors: [],
    warnings,
    metadata: { skippedChecks },
  }
}

/**
 * Create a failed validation result
 */
export function createErrorResult<T>(
  errors: ValidationError[],
  warnings: ValidationError[] = [],
  skippedChecks: string[] = [],
): ValidationResult<T> {
  return {
    success: false,
    errors,
    warnings,
    metadata: { skippedChecks },
  }
}
