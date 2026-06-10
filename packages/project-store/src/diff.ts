// computeDiff — derives Diff from two full Version objects.
// Diffs are computed, never stored (schema doc A2).

import type { Version, Diff, DiffChange, DiffKind } from "@copper/contracts";

export function computeDiff(from: Version, to: Version): Diff {
  const changes: DiffChange[] = [];
  diffValues("", from, to, changes);
  return { from: from.version, to: to.version, changes };
}

function diffValues(
  path: string,
  a: unknown,
  b: unknown,
  out: DiffChange[],
): void {
  if (a === b) return;

  if (a === null || a === undefined) {
    out.push({ path, kind: "added", before: a, after: b });
    return;
  }
  if (b === null || b === undefined) {
    out.push({ path, kind: "removed", before: a, after: b });
    return;
  }

  const typeA = typeof a;
  const typeB = typeof b;

  if (typeA !== typeB || typeA !== "object") {
    out.push({ path, kind: "modified", before: a, after: b });
    return;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    diffArrays(path, a, b, out);
    return;
  }

  if (!Array.isArray(a) && !Array.isArray(b)) {
    diffObjects(
      path,
      a as Record<string, unknown>,
      b as Record<string, unknown>,
      out,
    );
    return;
  }

  // One is array, one is object — treat as modified
  out.push({ path, kind: "modified", before: a, after: b });
}

function diffObjects(
  path: string,
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  out: DiffChange[],
): void {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const childPath = path ? `${path}.${key}` : key;
    if (!(key in a)) {
      out.push({ path: childPath, kind: "added" as DiffKind, before: undefined, after: b[key] });
    } else if (!(key in b)) {
      out.push({ path: childPath, kind: "removed" as DiffKind, before: a[key], after: undefined });
    } else {
      diffValues(childPath, a[key], b[key], out);
    }
  }
}

function diffArrays(
  path: string,
  a: unknown[],
  b: unknown[],
  out: DiffChange[],
): void {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const childPath = `${path}[${i}]`;
    if (i >= a.length) {
      out.push({ path: childPath, kind: "added",   before: undefined, after: b[i] });
    } else if (i >= b.length) {
      out.push({ path: childPath, kind: "removed", before: a[i], after: undefined });
    } else {
      diffValues(childPath, a[i], b[i], out);
    }
  }
}
