import type { DiffOp } from './myers';

export interface ChangeBlock {
  /** 块序号，从 1 开始 */
  index: number;
  deletes: DiffOp[];
  inserts: DiffOp[];
  oldStart: number | null;
  oldEnd: number | null;
  newStart: number | null;
  newEnd: number | null;
}

export interface EqualRow {
  kind: 'equal';
  oldLineNo: number;
  newLineNo: number;
  text: string;
}

export interface ChangeRow {
  kind: 'change';
  block: ChangeBlock;
}

export type ViewItem = EqualRow | ChangeRow;

/**
 * 将编辑脚本折叠为「相同行 + 连续变更块」视图。
 * 变更块内固定排列为：先删除（旧版行），紧邻插入（新版行）。
 */
export function buildView(ops: DiffOp[]): ViewItem[] {
  const items: ViewItem[] = [];
  let pending: DiffOp[] | null = null;
  let blockIndex = 0;

  const flush = () => {
    if (!pending || pending.length === 0) return;
    const deletes = pending.filter((op) => op.type === 'delete');
    const inserts = pending.filter((op) => op.type === 'insert');

    let oldStart: number | null = null;
    let oldEnd: number | null = null;
    let newStart: number | null = null;
    let newEnd: number | null = null;
    for (const op of deletes) {
      if (op.oldLineNo === null) continue;
      oldStart = oldStart === null ? op.oldLineNo : Math.min(oldStart, op.oldLineNo);
      oldEnd = oldEnd === null ? op.oldLineNo : Math.max(oldEnd, op.oldLineNo);
    }
    for (const op of inserts) {
      if (op.newLineNo === null) continue;
      newStart = newStart === null ? op.newLineNo : Math.min(newStart, op.newLineNo);
      newEnd = newEnd === null ? op.newLineNo : Math.max(newEnd, op.newLineNo);
    }

    blockIndex++;
    items.push({
      kind: 'change',
      block: { index: blockIndex, deletes, inserts, oldStart, oldEnd, newStart, newEnd },
    });
    pending = null;
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      flush();
      items.push({
        kind: 'equal',
        oldLineNo: op.oldLineNo as number,
        newLineNo: op.newLineNo as number,
        text: op.text,
      });
    } else {
      if (!pending) pending = [];
      pending.push(op);
    }
  }
  flush();

  return items;
}

export function formatRange(start: number | null, end: number | null): string {
  if (start === null || end === null) return '—';
  return start === end ? `${start}` : `${start}–${end}`;
}
