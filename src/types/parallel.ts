interface ParallelClass {
  /**
   * Defines different variables for jobs that are running in parallel.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrix: Record<string, any[] | number | string>[]
}

export type { ParallelClass }
