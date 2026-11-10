---
name: Native Node tests
description: Running JavaScript test files that import TypeScript source in this workspace.
---

Use Node's built-in TypeScript type stripping for `node:test` files that import `.ts` source directly; no `tsx` loader dependency is needed in the current Node 24 runtime. Keep tests on leaf modules with explicit TypeScript extensions when the production module graph pulls in workspace-generated packages with extensionless imports. For nested subtests, create child tests through the context passed to that subtest's callback, not an ancestor context.

**Why:** Adding `tsx` to an artifact only for a small test caused unrelated workspace lockfile resolution changes. Node can strip imported TypeScript but does not resolve extensionless generated workspace imports in the same way as Vite. Attaching awaited nested tests to an ancestor context can leave the parent test pending.

**How to apply:** Before adding a test loader for `.ts` imports, confirm the active Node runtime supports native type stripping and run the test with plain `node --test`. If the production module graph fails resolution, isolate the dependency-injected logic under test instead of changing unrelated generated imports. When nesting tests, call `childContext.test()` inside the child callback.
