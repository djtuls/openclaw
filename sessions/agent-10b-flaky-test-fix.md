# Agent 10b — Flaky getCacheHealth Test Fix

**Date**: 2026-02-17
**Duration**: ~2 sessions (Sessions 7-8 of the Phase 4 verification arc)
**Status**: ✅ COMPLETE

## Summary

Discovered and fixed a flaky test in `knowledge-cache.test.ts` that was intermittently failing due to disk I/O timing affecting the `avgLoadTimeMs` health metric.

## Root Cause

The `getCacheHealth` test "reports healthy when hit rate is above 80%" performed:

- 1 cache miss (disk read) + 4 cache hits = 5 total loads

With slow disk I/O (>250ms on the miss), `avgLoadTimeMs = totalLoadTimeMs / 5` could exceed the 50ms health threshold, triggering `status: "warning"` instead of the expected `"healthy"`.

The test was designed to validate hit-rate health, but the load-time health check was a separate dimension that could independently flip the status.

## Fix Applied

**File**: `src/agents/tulsbot/knowledge-cache.test.ts` (lines 369-383)

Changed from 1 miss + 4 hits (5 loads) to 1 miss + 9 hits (10 loads):

```typescript
// BEFORE (flaky):
await findAgentByName(agentNames[0]); // miss
await findAgentByName(agentNames[0]); // hit x4

// AFTER (robust):
await findAgentByName(agentNames[0]); // miss (disk read)
for (let i = 0; i < 9; i++) {
  await findAgentByName(agentNames[0]); // hit (from cache)
}
```

This dilutes `avgLoadTimeMs` so even a 500ms disk read results in avg ~50ms. Hit rate also improved from 80% to 90%, still validating the ">80% = healthy" path.

## Verification

- `npx vitest run src/agents/tulsbot/knowledge-cache.test.ts` — **43/43 tests pass**
- Full regression (from earlier session): 778/781 files pass, 6216/6236 tests pass

## Pattern Learned

**I/O-dependent metric flakiness**: When health checks combine multiple dimensions (hit rate, utilization, load time), a single slow disk operation can trip a threshold the test didn't intend to exercise. Fix pattern: _dilution_ — add more fast operations to bring computed averages back below thresholds, rather than loosening production thresholds further.

## Files Modified

| File                                         | Change                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| `src/agents/tulsbot/knowledge-cache.test.ts` | Increased cache hits from 4→9 in getCacheHealth healthy test |
| `MEMORY.md`                                  | Added flaky test pattern, updated Agent 10 fixes list        |

## Remaining Pre-existing Failures (7 tests, not in scope)

- `unhandled-rejections.fatal-detection.test.ts` (5): Log prefix mismatch
- `extensions/feishu/src/mention.test.ts` (2): Invalid `toEndWith` matcher
