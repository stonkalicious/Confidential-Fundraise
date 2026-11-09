---
name: Native Node tests
description: Running JavaScript test files that import TypeScript source in this workspace.
---

Use Node's built-in TypeScript type stripping for `node:test` files that import `.ts` source directly; no `tsx` loader dependency is needed in the current Node 24 runtime. For nested subtests, create child tests through the context passed to that subtest's callback, not an ancestor context.

**Why:** Adding `tsx` to an artifact only for a small test caused unrelated workspace lockfile resolution changes. Attaching awaited nested tests to an ancestor context can leave the parent test pending.

**How to apply:** Before adding a test loader for `.ts` imports, confirm the active Node runtime supports native type stripping and run the test with plain `node --test`. When nesting tests, call `childContext.test()` inside the child callback.
