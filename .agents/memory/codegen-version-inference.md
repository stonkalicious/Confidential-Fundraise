---
name: Codegen version inference
description: Why code generation needs explicit target library versions in this workspace.
---

Do not rely on Orval automatically detecting target library versions from pnpm catalog declarations.

**Why:** During dependency remediation, Orval could not infer React Query's installed version and fell back to v4 despite the workspace using v5. Zod target inference has the same catalog-resolution limitation.

**How to apply:** When upgrading the generator or target libraries, explicitly align the generator targets with the workspace's actual versions and regenerate both schemas and hooks. A successful generation alone does not establish compatibility.
