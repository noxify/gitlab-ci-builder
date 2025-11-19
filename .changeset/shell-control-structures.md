---
"@noxify/gitlab-ci-builder": patch
---

Fix script parser to preserve shell control structures

The YAML importer now correctly detects and preserves shell control structures (if/then/else/fi, for/do/done, while/do/done, until/do/done, case/esac) as template literals instead of splitting them into separate array elements.

Previously, multi-line scripts with control structures were incorrectly split:

```typescript
// Before (incorrect)
script: ['if [ "$VAR" = "true" ]; then', 'echo "yes"', "else", 'echo "no"', "fi"]
```

Now they are preserved as cohesive blocks:

```typescript
// After (correct)
script: [
  `if [ "$VAR" = "true" ]; then
  echo "yes"
else
  echo "no"
fi
`,
]
```

This ensures shell scripts with control flow are generated correctly and maintain their intended structure.
