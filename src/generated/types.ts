// Generated types from Zod schemas
// Do not edit manually - run 'pnpm generate:types' to regenerate

/**
 * @see https://docs.gitlab.com/ci/yaml/#rules
 */
export interface Rule {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesif
   */
  if?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
   */
  when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
   */
  changes?:
    | string
    | string[]
    | {
        paths: string[]
        compare_to?: string
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesexists
   */
  exists?:
    | string[]
    | {
        paths: string[]
        project?: string
        ref?: string
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
   */
  allow_failure?:
    | boolean
    | {
        exit_codes: number | number[]
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
   */
  variables?: Record<string, string | number | boolean>
  /**
   * @see https://docs.gitlab.com/ci/yaml/#when
   */
  start_in?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
   */
  needs?: (
    | string
    | {
        job: string
        artifacts?: boolean
        optional?: boolean
      }
  )[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
   */
  interruptible?: boolean
}

/**
 * @see https://docs.gitlab.com/ci/yaml/#artifacts
 */
export interface Artifacts {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsname
   */
  name?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactspaths
   */
  paths?: string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsexclude
   */
  exclude?: string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsexpose_as
   */
  expose_as?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsuntracked
   */
  untracked?: boolean
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactswhen
   */
  when?: "on_success" | "on_failure" | "always"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsexpire_in
   */
  expire_in?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsaccess
   */
  access?: "none" | "developer" | "all"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifactsreports
   */
  reports?: {
    accessibility?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsannotations
     */
    annotations?: string
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsjunit
     */
    junit?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsbrowser_performance
     */
    browser_performance?: string
    coverage_report?: {
      coverage_format: "cobertura" | "jacoco"
      path: string
    }
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscodequality-starter
     */
    codequality?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdotenv
     */
    dotenv?: string | string[]
    lsif?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportssast-ultimate
     */
    sast?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdependency_scanning-ultimate
     */
    dependency_scanning?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscontainer_scanning-ultimate
     */
    container_scanning?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdast-ultimate
     */
    dast?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportslicense_scanning-ultimate
     */
    license_scanning?: string | string[]
    requirements?: string | string[]
    secret_detection?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsmetrics
     */
    metrics?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsterraform
     */
    terraform?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportscyclonedx
     */
    cyclonedx?: string | string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsload_performance
     */
    load_performance?: string | string[]
    repository_xray?: string | string[]
  }
}

/**
 * @see https://docs.gitlab.com/ci/yaml/#cache
 */
export interface Cache {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cachekey
   */
  key?:
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles
         */
        files?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles_commits
         */
        files_commits?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekeyprefix
         */
        prefix?: string
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cachepaths
   */
  paths?: string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cacheuntracked
   */
  untracked?: boolean
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cachewhen
   */
  when?: "on_success" | "on_failure" | "always"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cachepolicy
   */
  policy?: "pull" | "push" | "pull-push"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cacheunprotect
   */
  unprotect?: boolean
  /**
   * @see https://docs.gitlab.com/ci/yaml/#cachefallback_keys
   *
   * @maxItems 5
   */
  fallback_keys?:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
}

export type _Schema0 =
  | {
      name: string
      env?: Record<string, string>
      inputs?: Record<
        string,
        string | number | boolean | null | unknown[] | Record<string, unknown>
      >
      step:
        | string
        | {
            git: {
              url: string
              rev: string
              dir?: string
              file?: string
            }
          }
        | {
            oci: {
              registry: string
              repository: string
              tag: string
              dir?: string
              file?: string
            }
          }
    }
  | {
      env?: Record<string, string>
      run: _Schema0[]
      outputs?: Record<
        string,
        string | number | boolean | null | unknown[] | Record<string, unknown>
      >
      delegate?: string
    }
  | {
      name: string
      env?: Record<string, string>
      inputs?: Record<
        string,
        string | number | boolean | null | unknown[] | Record<string, unknown>
      >
      action: string
    }
  | {
      name: string
      env?: Record<string, string>
      script: string
    }
  | {
      env?: Record<string, string>
      exec: {
        /**
         * @minItems 1
         */
        command: [string, ...string[]]
        work_dir?: string
      }
    }

export interface BaseJob {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#stage
   */
  stage?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#script
   */
  script?: string | string[]
  run?: _Schema0[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#before_script
   */
  before_script?: string | string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#after_script
   */
  after_script?: string | string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#image
   */
  image?:
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagename
         */
        name: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imageentrypoint
         */
        entrypoint?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagedocker
         */
        docker?: {
          platform?: string
          user?: string
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagekubernetes
         */
        kubernetes?: {
          user?: string | number
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagepull_policy
         */
        pull_policy?:
          | ("always" | "never" | "if-not-present")
          | ("always" | "never" | "if-not-present")[]
      }
  services?: (
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesname
         */
        name: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesalias
         */
        alias?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesentrypoint
         */
        entrypoint?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicescommand
         */
        command?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesdocker
         */
        docker?: {
          platform?: string
          user?: string
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagekubernetes
         */
        kubernetes?: {
          user?: string | number
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicespull_policy
         */
        pull_policy?:
          | ("always" | "never" | "if-not-present")
          | ("always" | "never" | "if-not-present")[]
        variables?: Record<string, string | number | boolean>
      }
  )[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#tags
   */
  tags?: string[]
  variables?: Record<string, unknown>
  rules?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesif
     */
    if?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
     */
    when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
     */
    changes?:
      | string
      | string[]
      | {
          paths: string[]
          compare_to?: string
        }
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesexists
     */
    exists?:
      | string[]
      | {
          paths: string[]
          project?: string
          ref?: string
        }
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
     */
    allow_failure?:
      | boolean
      | {
          exit_codes: number | number[]
        }
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
     */
    variables?: Record<string, string | number | boolean>
    /**
     * @see https://docs.gitlab.com/ci/yaml/#when
     */
    start_in?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
     */
    needs?: (
      | string
      | {
          job: string
          artifacts?: boolean
          optional?: boolean
        }
    )[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
     */
    interruptible?: boolean
  }[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#extends
   */
  extends?: Record<string, unknown>
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifacts
   */
  artifacts?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsname
     */
    name?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactspaths
     */
    paths?: string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsexclude
     */
    exclude?: string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsexpose_as
     */
    expose_as?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsuntracked
     */
    untracked?: boolean
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactswhen
     */
    when?: "on_success" | "on_failure" | "always"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsexpire_in
     */
    expire_in?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsaccess
     */
    access?: "none" | "developer" | "all"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsreports
     */
    reports?: {
      accessibility?: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsannotations
       */
      annotations?: string
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsjunit
       */
      junit?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsbrowser_performance
       */
      browser_performance?: string
      coverage_report?: {
        coverage_format: "cobertura" | "jacoco"
        path: string
      }
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscodequality-starter
       */
      codequality?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdotenv
       */
      dotenv?: string | string[]
      lsif?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportssast-ultimate
       */
      sast?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdependency_scanning-ultimate
       */
      dependency_scanning?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscontainer_scanning-ultimate
       */
      container_scanning?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdast-ultimate
       */
      dast?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportslicense_scanning-ultimate
       */
      license_scanning?: string | string[]
      requirements?: string | string[]
      secret_detection?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsmetrics
       */
      metrics?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsterraform
       */
      terraform?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportscyclonedx
       */
      cyclonedx?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsload_performance
       */
      load_performance?: string | string[]
      repository_xray?: string | string[]
    }
  }
  cache?:
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekey
         */
        key?:
          | string
          | {
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles
               */
              files?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles_commits
               */
              files_commits?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyprefix
               */
              prefix?: string
            }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepaths
         */
        paths?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheuntracked
         */
        untracked?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachewhen
         */
        when?: "on_success" | "on_failure" | "always"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepolicy
         */
        policy?: "pull" | "push" | "pull-push"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheunprotect
         */
        unprotect?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachefallback_keys
         *
         * @maxItems 5
         */
        fallback_keys?:
          | []
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string]
          | [string, string, string, string, string]
      }
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekey
         */
        key?:
          | string
          | {
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles
               */
              files?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles_commits
               */
              files_commits?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyprefix
               */
              prefix?: string
            }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepaths
         */
        paths?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheuntracked
         */
        untracked?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachewhen
         */
        when?: "on_success" | "on_failure" | "always"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepolicy
         */
        policy?: "pull" | "push" | "pull-push"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheunprotect
         */
        unprotect?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachefallback_keys
         *
         * @maxItems 5
         */
        fallback_keys?:
          | []
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string]
          | [string, string, string, string, string]
      }[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#needs
   */
  needs?:
    | string
    | (
        | string
        | {
            job: string
            artifacts?: boolean
            optional?: boolean
          }
        | {
            job: string
            pipeline: string
            artifacts?: boolean
          }
        | {
            job: string
            project: string
            ref: string
            artifacts?: boolean
          }
      )[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#dependencies
   */
  dependencies?: string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#allow_failure
   */
  allow_failure?:
    | boolean
    | {
        exit_codes: number | number[]
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#when
   */
  when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#timeout
   */
  timeout?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#retry
   */
  retry?:
    | number
    | {
        max: number
        when?: string | string[]
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#parallel
   */
  parallel?:
    | number
    | {
        matrix: Record<string, unknown[]>[]
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#interruptible
   */
  interruptible?: boolean
  /**
   * @see https://docs.gitlab.com/ci/yaml/#resource_group
   */
  resource_group?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#environment
   */
  environment?:
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#environmentname
         */
        name: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#environmenturl
         */
        url?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#environmenton_stop
         */
        on_stop?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#environmentauto_stop_in
         */
        auto_stop_in?: string
        deployment_tier?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#environmentaction
         */
        action?: "start" | "prepare" | "stop" | "verify" | "access"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#environmentkubernetes
         */
        kubernetes?: {
          agent?: string
          namespace?: string
          flux_resource_path?: string
          managed_resources?: {
            enabled?: boolean
          }
          dashboard?: {
            namespace?: string
            flux_resource_path?: string
          }
        }
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#release
   */
  release?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releasetag_name
     */
    tag_name: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releasetag_message
     */
    tag_message?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releasedescription
     */
    description?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releasename
     */
    name?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releaseref
     */
    ref?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releasemilestones
     */
    milestones?: string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releasereleased_at
     */
    released_at?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#releaseassets
     */
    assets?: {
      links: {
        name: string
        url: string
        filepath?: string
        link_type?: "runbook" | "package" | "image" | "other"
      }[]
    }
  }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#trigger
   */
  trigger?:
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerproject
         */
        project: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerbranch
         */
        branch?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerstrategy
         */
        strategy?: "depend" | "mirror"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerforward
         */
        forward?: {
          /**
           * @see https://docs.gitlab.com/ci/yaml/#triggerforward
           */
          yaml_variables?: boolean
          /**
           * @see https://docs.gitlab.com/ci/yaml/#triggerforward
           */
          pipeline_variables?: boolean
        }
      }
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerinclude
         */
        include: Record<string, unknown>
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerstrategy
         */
        strategy?: "depend" | "mirror"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#triggerforward
         */
        forward?: {
          /**
           * @see https://docs.gitlab.com/ci/yaml/#triggerforward
           */
          yaml_variables?: boolean
          /**
           * @see https://docs.gitlab.com/ci/yaml/#triggerforward
           */
          pipeline_variables?: boolean
        }
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#id_tokens
   */
  id_tokens?: Record<
    string,
    {
      aud: string | string[]
    }
  >
  /**
   * @see https://docs.gitlab.com/ci/yaml/#secrets
   */
  secrets?: Record<
    string,
    {
      /**
       * @see https://docs.gitlab.com/ci/yaml/#secretsvault
       */
      vault?:
        | string
        | {
            engine: {
              name: string
              path: string
            }
            path: string
            field: string
          }
      gcp_secret_manager?: {
        name: string
        version?: string | number
      }
      azure_key_vault?: {
        name: string
        version?: string
      }
      aws_secrets_manager?:
        | string
        | {
            secret_id: string
            version_id?: string
            version_stage?: string
            region?: string
            role_arn?: string
            role_session_name?: string
            field?: string
          }
      /**
       * @see https://docs.gitlab.com/ci/yaml/#secretsfile
       */
      file?: boolean
      token?: string
    }
  >
  /**
   * @see https://docs.gitlab.com/ci/yaml/#hooks
   */
  hooks?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#hookspre_get_sources_script
     */
    pre_get_sources_script?: string | string[]
  }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#inherit
   */
  inherit?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#inheritdefault
     */
    default?: boolean | string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#inheritvariables
     */
    variables?: boolean | string[]
  }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#coverage
   */
  coverage?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#manual_confirmation
   */
  manual_confirmation?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#inputs
   */
  inputs?: Record<
    string,
    {
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputstype
       */
      type?: "string" | "number" | "boolean" | "array"
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsdescription
       */
      description?: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsoptions
       */
      options?: (string | number | boolean)[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsregex
       */
      regex?: string
      default: unknown
      rules?: Record<string, unknown>[]
    }
  >
  /**
   * @see https://docs.gitlab.com/ci/yaml/#pages
   */
  pages?:
    | boolean
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#pagespath_prefix
         */
        path_prefix?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#pagesexpire_in
         */
        expire_in?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#pagespublish
         */
        publish?: string
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#only--except
   */
  only?:
    | string[]
    | {
        refs?: string[]
        kubernetes?: "active"
        variables?: string[]
        changes?: string[]
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#only--except
   */
  except?:
    | string[]
    | {
        refs?: string[]
        kubernetes?: "active"
        variables?: string[]
        changes?: string[]
      }
}

/**
 * @see https://docs.gitlab.com/ci/yaml/#include
 */
export type IncludeInput =
  | string
  | (
      | {
          /**
           * @see https://docs.gitlab.com/ci/yaml/#includelocal
           */
          local: string
          rules?: {
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesif
             */
            if?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
             */
            when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
             */
            changes?:
              | string
              | string[]
              | {
                  paths: string[]
                  compare_to?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesexists
             */
            exists?:
              | string[]
              | {
                  paths: string[]
                  project?: string
                  ref?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
             */
            allow_failure?:
              | boolean
              | {
                  exit_codes: number | number[]
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
             */
            variables?: Record<string, string | number | boolean>
            /**
             * @see https://docs.gitlab.com/ci/yaml/#when
             */
            start_in?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
             */
            needs?: (
              | string
              | {
                  job: string
                  artifacts?: boolean
                  optional?: boolean
                }
            )[]
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
             */
            interruptible?: boolean
          }[]
          /**
           * @see https://docs.gitlab.com/ci/inputs/
           */
          inputs?: Record<string, unknown>
        }
      | {
          remote: string
          rules?: {
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesif
             */
            if?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
             */
            when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
             */
            changes?:
              | string
              | string[]
              | {
                  paths: string[]
                  compare_to?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesexists
             */
            exists?:
              | string[]
              | {
                  paths: string[]
                  project?: string
                  ref?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
             */
            allow_failure?:
              | boolean
              | {
                  exit_codes: number | number[]
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
             */
            variables?: Record<string, string | number | boolean>
            /**
             * @see https://docs.gitlab.com/ci/yaml/#when
             */
            start_in?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
             */
            needs?: (
              | string
              | {
                  job: string
                  artifacts?: boolean
                  optional?: boolean
                }
            )[]
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
             */
            interruptible?: boolean
          }[]
          /**
           * @see https://docs.gitlab.com/ci/inputs/
           */
          inputs?: Record<string, unknown>
          integrity?: string
        }
      | {
          /**
           * @see https://docs.gitlab.com/ci/yaml/#includeproject
           */
          project: string
          /**
           * @see https://docs.gitlab.com/ci/yaml/#includefile
           */
          file: string | string[]
          /**
           * @see https://docs.gitlab.com/ci/yaml/#includeref
           */
          ref?: string
          rules?: {
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesif
             */
            if?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
             */
            when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
             */
            changes?:
              | string
              | string[]
              | {
                  paths: string[]
                  compare_to?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesexists
             */
            exists?:
              | string[]
              | {
                  paths: string[]
                  project?: string
                  ref?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
             */
            allow_failure?:
              | boolean
              | {
                  exit_codes: number | number[]
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
             */
            variables?: Record<string, string | number | boolean>
            /**
             * @see https://docs.gitlab.com/ci/yaml/#when
             */
            start_in?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
             */
            needs?: (
              | string
              | {
                  job: string
                  artifacts?: boolean
                  optional?: boolean
                }
            )[]
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
             */
            interruptible?: boolean
          }[]
          /**
           * @see https://docs.gitlab.com/ci/inputs/
           */
          inputs?: Record<string, unknown>
        }
      | {
          /**
           * @see https://docs.gitlab.com/ci/yaml/#includetemplate
           */
          template: string
          rules?: {
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesif
             */
            if?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
             */
            when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
             */
            changes?:
              | string
              | string[]
              | {
                  paths: string[]
                  compare_to?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesexists
             */
            exists?:
              | string[]
              | {
                  paths: string[]
                  project?: string
                  ref?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
             */
            allow_failure?:
              | boolean
              | {
                  exit_codes: number | number[]
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
             */
            variables?: Record<string, string | number | boolean>
            /**
             * @see https://docs.gitlab.com/ci/yaml/#when
             */
            start_in?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
             */
            needs?: (
              | string
              | {
                  job: string
                  artifacts?: boolean
                  optional?: boolean
                }
            )[]
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
             */
            interruptible?: boolean
          }[]
          /**
           * @see https://docs.gitlab.com/ci/inputs/
           */
          inputs?: Record<string, unknown>
        }
      | {
          /**
           * @see https://docs.gitlab.com/ci/yaml/#includecomponent
           */
          component: string
          /**
           * @see https://docs.gitlab.com/ci/inputs/
           */
          inputs?: Record<string, unknown>
          rules?: {
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesif
             */
            if?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
             */
            when?: "on_success" | "on_failure" | "always" | "never" | "manual" | "delayed"
            /**
             * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
             */
            changes?:
              | string
              | string[]
              | {
                  paths: string[]
                  compare_to?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesexists
             */
            exists?:
              | string[]
              | {
                  paths: string[]
                  project?: string
                  ref?: string
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesallow_failure
             */
            allow_failure?:
              | boolean
              | {
                  exit_codes: number | number[]
                }
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
             */
            variables?: Record<string, string | number | boolean>
            /**
             * @see https://docs.gitlab.com/ci/yaml/#when
             */
            start_in?: string
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesneeds
             */
            needs?: (
              | string
              | {
                  job: string
                  artifacts?: boolean
                  optional?: boolean
                }
            )[]
            /**
             * @see https://docs.gitlab.com/ci/yaml/#rulesinterruptible
             */
            interruptible?: boolean
          }[]
        }
    )

/**
 * @see https://docs.gitlab.com/ci/yaml/#workflowrules
 */
export interface WorkflowRule {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesif
   */
  if?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
   */
  when?: "always" | "never"
  /**
   * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
   */
  changes?:
    | string
    | string[]
    | {
        paths: string[]
        compare_to?: string
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesexists
   */
  exists?:
    | string[]
    | {
        paths: string[]
        project?: string
        ref?: string
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
   */
  variables?: Record<string, string | number | boolean>
  /**
   * @see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_new_commit
   */
  auto_cancel?: {
    on_new_commit?: "conservative" | "interruptible" | "none"
    on_job_failure?: "all" | "none"
  }
}

/**
 * @see https://docs.gitlab.com/ci/yaml/#workflow
 */
export interface Workflow {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#workflowname
   */
  name?: string
  rules: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesif
     */
    if?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#ruleswhen
     */
    when?: "always" | "never"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#ruleschanges
     */
    changes?:
      | string
      | string[]
      | {
          paths: string[]
          compare_to?: string
        }
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesexists
     */
    exists?:
      | string[]
      | {
          paths: string[]
          project?: string
          ref?: string
        }
    /**
     * @see https://docs.gitlab.com/ci/yaml/#rulesvariables
     */
    variables?: Record<string, string | number | boolean>
    /**
     * @see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_new_commit
     */
    auto_cancel?: {
      on_new_commit?: "conservative" | "interruptible" | "none"
      on_job_failure?: "all" | "none"
    }
  }[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#workflowauto_cancel
   */
  auto_cancel?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_new_commit
     */
    on_new_commit?: "conservative" | "interruptible" | "none"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#workflowauto_cancelon_job_failure
     */
    on_job_failure?: "all" | "none"
  }
}

/**
 * @see https://docs.gitlab.com/ee/ci/yaml/#default
 */
export interface Defaults {
  /**
   * @see https://docs.gitlab.com/ci/yaml/#image
   */
  image?:
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagename
         */
        name: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imageentrypoint
         */
        entrypoint?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagedocker
         */
        docker?: {
          platform?: string
          user?: string
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagekubernetes
         */
        kubernetes?: {
          user?: string | number
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagepull_policy
         */
        pull_policy?:
          | ("always" | "never" | "if-not-present")
          | ("always" | "never" | "if-not-present")[]
      }
  services?: (
    | string
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesname
         */
        name: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesalias
         */
        alias?: string
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesentrypoint
         */
        entrypoint?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicescommand
         */
        command?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicesdocker
         */
        docker?: {
          platform?: string
          user?: string
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#imagekubernetes
         */
        kubernetes?: {
          user?: string | number
        }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#servicespull_policy
         */
        pull_policy?:
          | ("always" | "never" | "if-not-present")
          | ("always" | "never" | "if-not-present")[]
        variables?: Record<string, string | number | boolean>
      }
  )[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#before_script
   */
  before_script?: string | string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#after_script
   */
  after_script?: string | string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#tags
   */
  tags?: string[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#artifacts
   */
  artifacts?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsname
     */
    name?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactspaths
     */
    paths?: string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsexclude
     */
    exclude?: string[]
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsexpose_as
     */
    expose_as?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsuntracked
     */
    untracked?: boolean
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactswhen
     */
    when?: "on_success" | "on_failure" | "always"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsexpire_in
     */
    expire_in?: string
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsaccess
     */
    access?: "none" | "developer" | "all"
    /**
     * @see https://docs.gitlab.com/ci/yaml/#artifactsreports
     */
    reports?: {
      accessibility?: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsannotations
       */
      annotations?: string
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsjunit
       */
      junit?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsbrowser_performance
       */
      browser_performance?: string
      coverage_report?: {
        coverage_format: "cobertura" | "jacoco"
        path: string
      }
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscodequality-starter
       */
      codequality?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdotenv
       */
      dotenv?: string | string[]
      lsif?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportssast-ultimate
       */
      sast?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdependency_scanning-ultimate
       */
      dependency_scanning?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportscontainer_scanning-ultimate
       */
      container_scanning?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsdast-ultimate
       */
      dast?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportslicense_scanning-ultimate
       */
      license_scanning?: string | string[]
      requirements?: string | string[]
      secret_detection?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsmetrics
       */
      metrics?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/pipelines/job_artifacts.html#artifactsreportsterraform
       */
      terraform?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportscyclonedx
       */
      cyclonedx?: string | string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/artifacts_reports/#artifactsreportsload_performance
       */
      load_performance?: string | string[]
      repository_xray?: string | string[]
    }
  }
  cache?:
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekey
         */
        key?:
          | string
          | {
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles
               */
              files?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles_commits
               */
              files_commits?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyprefix
               */
              prefix?: string
            }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepaths
         */
        paths?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheuntracked
         */
        untracked?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachewhen
         */
        when?: "on_success" | "on_failure" | "always"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepolicy
         */
        policy?: "pull" | "push" | "pull-push"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheunprotect
         */
        unprotect?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachefallback_keys
         *
         * @maxItems 5
         */
        fallback_keys?:
          | []
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string]
          | [string, string, string, string, string]
      }
    | {
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachekey
         */
        key?:
          | string
          | {
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles
               */
              files?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyfiles_commits
               */
              files_commits?: string[]
              /**
               * @see https://docs.gitlab.com/ci/yaml/#cachekeyprefix
               */
              prefix?: string
            }
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepaths
         */
        paths?: string[]
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheuntracked
         */
        untracked?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachewhen
         */
        when?: "on_success" | "on_failure" | "always"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachepolicy
         */
        policy?: "pull" | "push" | "pull-push"
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cacheunprotect
         */
        unprotect?: boolean
        /**
         * @see https://docs.gitlab.com/ci/yaml/#cachefallback_keys
         *
         * @maxItems 5
         */
        fallback_keys?:
          | []
          | [string]
          | [string, string]
          | [string, string, string]
          | [string, string, string, string]
          | [string, string, string, string, string]
      }[]
  /**
   * @see https://docs.gitlab.com/ci/yaml/#retry
   */
  retry?:
    | number
    | {
        max: number
        when?: string | string[]
      }
  /**
   * @see https://docs.gitlab.com/ci/yaml/#timeout
   */
  timeout?: string
  /**
   * @see https://docs.gitlab.com/ci/yaml/#interruptible
   */
  interruptible?: boolean
  id_tokens?: Record<
    string,
    {
      aud: string | string[]
    }
  >
  /**
   * @see https://docs.gitlab.com/ci/yaml/#hooks
   */
  hooks?: {
    /**
     * @see https://docs.gitlab.com/ci/yaml/#hookspre_get_sources_script
     */
    pre_get_sources_script?: string | string[]
  }
}

/**
 * @see https://docs.gitlab.com/ci/yaml/#spec
 */
export interface Spec {
  inputs?: Record<
    string,
    {
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputstype
       */
      type?: "string" | "number" | "boolean" | "array"
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsdescription
       */
      description?: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsoptions
       */
      options?: (string | number | boolean)[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsregex
       */
      regex?: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/#specinputsdefault
       */
      default?: Record<string, unknown>
      rules?: Record<string, unknown>[]
    } | null
  >
}

/**
 * @see https://docs.gitlab.com/ci/yaml/#script
 */
export type Script = string | string[]

/**
 * @see https://docs.gitlab.com/ci/yaml/#image
 */
export type Image =
  | string
  | {
      /**
       * @see https://docs.gitlab.com/ci/yaml/#imagename
       */
      name: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/#imageentrypoint
       */
      entrypoint?: string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/#imagedocker
       */
      docker?: {
        platform?: string
        user?: string
      }
      /**
       * @see https://docs.gitlab.com/ci/yaml/#imagekubernetes
       */
      kubernetes?: {
        user?: string | number
      }
      /**
       * @see https://docs.gitlab.com/ci/yaml/#imagepull_policy
       */
      pull_policy?:
        | ("always" | "never" | "if-not-present")
        | ("always" | "never" | "if-not-present")[]
    }

/**
 * @see https://docs.gitlab.com/ci/yaml/#services
 */
export type Service =
  | string
  | {
      /**
       * @see https://docs.gitlab.com/ci/yaml/#servicesname
       */
      name: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/#servicesalias
       */
      alias?: string
      /**
       * @see https://docs.gitlab.com/ci/yaml/#servicesentrypoint
       */
      entrypoint?: string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/#servicescommand
       */
      command?: string[]
      /**
       * @see https://docs.gitlab.com/ci/yaml/#servicesdocker
       */
      docker?: {
        platform?: string
        user?: string
      }
      /**
       * @see https://docs.gitlab.com/ci/yaml/#imagekubernetes
       */
      kubernetes?: {
        user?: string | number
      }
      /**
       * @see https://docs.gitlab.com/ci/yaml/#servicespull_policy
       */
      pull_policy?:
        | ("always" | "never" | "if-not-present")
        | ("always" | "never" | "if-not-present")[]
      variables?: Record<string, string | number | boolean>
    }

/**
 * @see https://docs.gitlab.com/ci/yaml/#tags
 */
export type Tags = string[]
