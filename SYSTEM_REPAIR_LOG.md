# System Repair Log

This file records code-level system repair changes made to Writeflow. Use it when a fix changes project code or technical documentation in response to a system failure, schema contract issue, recovery gap, or automation defect.

Runtime content repairs and normal writing artifacts do not belong here. This log is for project-code/system-behavior changes only.

## Entry template

```markdown
## YYYY-MM-DD — Short repair title

**Trigger:** What failed or what risk was observed.

**Classification:** One of `schema_contract`, `prompt_contract`, `runtime_repair`, `failure_routing`, `pipeline_logic`, `ui_visibility`, `infrastructure`, or `documentation`.

**Changed files:**
- `path/to/file.ts` — what changed

**Behavior change:** What the system will do differently after this patch.

**Validation:** Commands or checks run, with pass/fail status.

**Remaining risks:** Known limitations, warnings, or follow-up work.
```

## 2026-07-21 — Review failure diagnosis schema normalization

**Trigger:** Autopilot review repair failed with `Agent response JSON did not match schema` even though the model returned valid JSON. The `ReviewFailureDiagnoser` produced natural-language enum labels such as `chapter`, `style`, `procedural_continuity_conflict`, and `tonal_register_mismatch`, plus `authorQuestion: null`, which did not match the strict Zod schema.

**Classification:** `schema_contract`, `runtime_repair`, `prompt_contract`, `documentation`.

**Changed files:**
- `README.md` — documents that schema contract issues are handled by runtime format repair and deterministic normalization before asking the user.
- `docs/product-plan.md` — documents that mechanical model-output/schema issues should auto-repair, while true narrative choices or system gaps escalate.
- `docs/technical-plan.md` — documents the Fault Arbiter / runtime repair / code-level repair boundary and the `normalizeOutput` execution step.
- `src/schemas/agent.ts` — adds optional `normalizeOutput` to agent definitions.
- `src/core/agent-runner.ts` — applies `normalizeOutput` after JSON parse and before Zod validation.
- `src/schemas/review-repair-normalizer.ts` — adds deterministic normalization for review-failure diagnosis enum aliases, optional null fields, and affected scope defaults.
- `src/agents/registry.ts` — connects `ReviewFailureDiagnoser` to the normalizer and strengthens prompt enum/null constraints.
- `SYSTEM_REPAIR_LOG.md` — adds this repair log and records the current repair.

**Behavior change:** `ReviewFailureDiagnoser` outputs now pass through a deterministic normalization layer before schema validation. Known low-risk aliases are mapped to canonical enum values, `authorQuestion: null` is omitted, and missing/invalid `affectedScope` is normalized to empty arrays. This reduces repeated human intervention for mechanical schema-contract failures without allowing the creative Autopilot to modify project code dynamically.

**Validation:**
- `npm run lint` — passed before this log file was added.
- `npm run build` — passed before this log file was added; build emitted an existing Turbopack NFT warning unrelated to the repair.

**Remaining risks:**
- The alias map only covers known review-diagnosis drift patterns; future model labels may still need new deterministic aliases.
- The current mechanism records code-level repair history in a repository file, not yet in the Writeflow UI or run artifacts.
- There is still no automated test runner configured; validation currently relies on lint/build plus targeted code review.
