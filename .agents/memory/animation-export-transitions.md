---
name: Animation export transitions
description: An export-specific failure mode for multi-phase animation scenes.
---

Avoid making recorder-driven internal scene phases depend on a preceding exit animation completing.

**Why:** A downloaded film had its full duration and soundtrack but blank frames for later phases of its opening. Exit-completion gating stalled during recording even though the preview and recording-wiring checks had appeared healthy.

**How to apply:** Keep internal phases able to appear independently on their scheduled timing. After changing transitions or repairing exports, inspect frames from the encoded MP4 at each internal phase and near the close; duration, audio presence and recording callbacks alone do not establish a correct export.
