import { describe, expect, it } from 'vitest';
import { buildView, formatRange } from './blocks';
import { diffLines } from './myers';
import { toLines, utf16Length } from './lines';
import { MAX_CODE_UNITS, MAX_LINES, validate } from './validate';

describe('buildView 连续变更块', () => {
  it('相邻的删除/插入合并为一个块，块内先删后插', () => {
    const r = diffLines(['1', '2', '3'], ['1', '9', '3']);
    const view = buildView(r.ops);
    expect(view.map((v) => v.kind)).toEqual(['equal', 'change', 'equal']);
    const change = view[1];
    if (change.kind !== 'change') throw new Error('expect change');
    expect(change.block.deletes.map((o) => o.oldLineNo)).toEqual([2]);
    expect(change.block.inserts.map((o) => o.newLineNo)).toEqual([2]);
    expect(change.block.oldStart).toBe(2);
  });

  it('被相同行隔开的编辑分为两个变更块', () => {
    const r = diffLines(['a', 'b', 'c', 'd'], ['a', 'B', 'c', 'D']);
    const blocks = buildView(r.ops).filter((v) => v.kind === 'change');
    expect(blocks).toHaveLength(2);
  });

  it('纯删除块与纯插入块的新区间为 null', () => {
    const removed = buildView(diffLines(['a', 'b'], ['a']).ops);
    const block = removed.find((v) => v.kind === 'change')!;
    if (block.kind !== 'change') throw new Error('expect change');
    expect(block.block.newStart).toBeNull();
    expect(block.block.oldStart).toBe(2);

    const added = buildView(diffLines(['a'], ['a', 'b']).ops);
    const block2 = added.find((v) => v.kind === 'change')!;
    if (block2.kind !== 'change') throw new Error('expect change');
    expect(block2.block.oldStart).toBeNull();
    expect(block2.block.newStart).toBe(2);
  });

  it('formatRange 区间格式', () => {
    expect(formatRange(3, 5)).toBe('3–5');
    expect(formatRange(2, 2)).toBe('2');
    expect(formatRange(null, null)).toBe('—');
  });
});

describe('toLines', () => {
  it('空文本为 0 行，末尾换行不产生空行', () => {
    expect(toLines('')).toEqual([]);
    expect(toLines('A\n')).toEqual(['A']);
    expect(toLines('A\n\n')).toEqual(['A', '']);
    expect(toLines('A\nB')).toEqual(['A', 'B']);
  });

  it('CR 视为行内容，仅以 LF 分行（保留空白）', () => {
    expect(toLines('A\r\nB')).toEqual(['A\r', 'B']);
    expect(toLines(' A ')).toEqual([' A ']);
  });

  it('以 JS length 计 UTF-16 码元', () => {
    expect(utf16Length('A')).toBe(1);
    expect(utf16Length('文')).toBe(1);
    expect(utf16Length('😀')).toBe(2);
  });
});

describe('validate 限额', () => {
  it('合法输入通过', () => {
    expect(validate(['a'], ['b'])).toEqual({ ok: true, old: null, new: null });
  });

  it('两侧各自列出首个超长行号', () => {
    const long = 'x'.repeat(MAX_CODE_UNITS + 1);
    const r = validate(['ok', long], [long, long]);
    expect(r.ok).toBe(false);
    expect(r.old).toEqual({ lineNo: 2, tooLong: true, tooMany: false });
    expect(r.new).toEqual({ lineNo: 1, tooLong: true, tooMany: false });
  });

  it('行数超限给出 tooMany 与首个违规行号，且超长行优先报告', () => {
    const many = Array.from({ length: MAX_LINES + 1 }, (_, i) => `l${i}`);
    const r = validate(many, []);
    expect(r.old?.tooMany).toBe(true);
    expect(r.old?.lineNo).toBe(MAX_LINES + 1);

    const longLast = [...Array.from({ length: MAX_LINES }, () => 'x'), 'y'.repeat(MAX_CODE_UNITS + 1)];
    const r2 = validate(longLast, []);
    expect(r2.old?.tooLong).toBe(true);
    expect(r2.old?.lineNo).toBe(MAX_LINES + 1);
  });
});
