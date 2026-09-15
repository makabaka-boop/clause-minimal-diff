import { describe, expect, it } from 'vitest';
import { backtrack, buildTrace, diffLines, previousKIsInsert, type DiffOp } from './myers';

function opsOf(a: string[], b: string[]): DiffOp[] {
  const trace = buildTrace(a, b);
  return backtrack(a, b, trace);
}

function signatures(ops: DiffOp[]): string {
  return ops.map((op) => op.type[0].toUpperCase()).join('');
}

describe('buildTrace 前向搜索', () => {
  it('d=0 从原点贪心匹配相同前缀', () => {
    const trace = buildTrace(['A', 'B', 'C'], ['A', 'B', 'X']);
    // 第 0 层 V[0] 应为贪心命中的 2
    expect(trace.layers[0].get(0)).toBe(2);
  });

  it('相同输入在 d=0 到达右下角', () => {
    const trace = buildTrace(['A', 'B'], ['A', 'B']);
    expect(trace.layers).toHaveLength(1);
    expect(trace.layers[0].get(0)).toBe(2);
    expect(trace.endX).toBe(2);
    expect(trace.endY).toBe(2);
  });

  it('空两侧只生成 d=0 层', () => {
    const trace = buildTrace([], []);
    expect(trace.layers).toHaveLength(1);
    expect(trace.layers[0].get(0)).toBe(0);
  });

  it('分层 k 与 d 同奇偶，端点始终满足 y=x-k', () => {
    const a = 'alpha beta gamma delta'.split(' ');
    const b = 'alpha beta2 gamma delta2'.split(' ');
    const trace = buildTrace(a, b);
    expect(trace.layers.length).toBeGreaterThanOrEqual(3);
    for (let d = 1; d < trace.layers.length; d++) {
      for (let k = -d; k <= d; k += 2) {
        const x = trace.layers[d].get(k);
        expect(x).toBeTypeOf('number');
        expect(x! - k).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('最小编辑距离等于层数减一', () => {
    const cases: Array<[string[], string[], number]> = [
      [['A', 'B'], ['A'], 1],
      [['A'], ['A', 'B'], 1],
      [['A', 'B'], ['A', 'C'], 2],
      [['A', 'A'], ['A'], 1],
      [[], ['X'], 1],
      [['X', 'Y', 'Z'], [], 3],
    ];
    for (const [a, b, dist] of cases) {
      expect(buildTrace(a, b).layers.length - 1).toBe(dist);
    }
  });
});

describe('previousKIsInsert 边界与中间判定', () => {
  it('k=-d 边界选插入，k=d 边界选删除', () => {
    const layer = buildTrace(['q'], ['q']).layers[0];
    expect(previousKIsInsert(layer, -3, 3)).toBe(true);
    expect(previousKIsInsert(layer, 3, 3)).toBe(false);
  });

  it('中间仅当 V[k-1] < V[k+1] 时插入，相等时删除（稳定删旧靠后行）', () => {
    const fake = {
      d: 1,
      get(k: number): number | undefined {
        if (k === -1) return 1;
        if (k === 1) return 2;
        return undefined;
      },
    };
    // d=2, k=0: V[-1]=1 < V[1]=2 => 插入
    expect(previousKIsInsert(fake, 0, 2)).toBe(true);

    const tied = {
      d: 1,
      get(k: number): number | undefined {
        return k === -1 || k === 1 ? 2 : undefined;
      },
    };
    expect(previousKIsInsert(tied, 0, 2)).toBe(false);
  });
});

describe('backtrack 反向回溯', () => {
  it('回溯覆盖全部行且行号连续、文本对应', () => {
    const cases: Array<[string[], string[]]> = [
      [['A', 'B', 'C'], ['A', 'X', 'C']],
      [['x', 'a', 'x'], ['a']],
      [['1', '2', '3', '4'], ['1', '22', '3', '44']],
    ];
    for (const [a, b] of cases) {
      const ops = opsOf(a, b);
      const oldSeen = ops.filter((o) => o.type !== 'insert').map((o) => o.oldLineNo);
      const newSeen = ops.filter((o) => o.type !== 'delete').map((o) => o.newLineNo);
      expect(oldSeen).toEqual([...Array(a.length)].map((_, i) => i + 1));
      expect(newSeen).toEqual([...Array(b.length)].map((_, i) => i + 1));
      for (const op of ops) {
        if (op.type === 'equal') {
          expect(a[(op.oldLineNo ?? 0) - 1]).toBe(b[(op.newLineNo ?? 0) - 1]);
        }
        if (op.type === 'delete') expect(op.text).toBe(a[(op.oldLineNo ?? 0) - 1]);
        if (op.type === 'insert') expect(op.text).toBe(b[(op.newLineNo ?? 0) - 1]);
      }
    }
  });

  it('相同输入全部为 equal', () => {
    const ops = opsOf(['A', 'B'], ['A', 'B']);
    expect(signatures(ops)).toBe('EE');
  });

  it('空两侧回溯为空脚本', () => {
    expect(opsOf([], [])).toEqual([]);
  });

  it('替换固定为删除紧邻插入（先 D 后 I）', () => {
    const ops = opsOf(['A', 'B'], ['A', 'C']);
    expect(signatures(ops)).toBe('EDI');
    expect(ops[1]).toMatchObject({ type: 'delete', oldLineNo: 2, newLineNo: null });
    expect(ops[2]).toMatchObject({ type: 'insert', oldLineNo: null, newLineNo: 2 });
  });

  it('重复行稳定性：旧版“A\\nA”对新版“A”删除旧版第 2 行', () => {
    const ops = opsOf(['A', 'A'], ['A']);
    expect(signatures(ops)).toBe('ED');
    const del = ops.find((o) => o.type === 'delete');
    expect(del).toBeDefined();
    expect(del!.oldLineNo).toBe(2);
    expect(del!.text).toBe('A');
  });

  it('纯插入：旧版“A”对新版“A\\nB”在第 2 行插入', () => {
    const ops = opsOf(['A'], ['A', 'B']);
    expect(signatures(ops)).toBe('EI');
    expect(ops[1]).toMatchObject({ type: 'insert', newLineNo: 2 });
  });

  it('区分大小写、保留空白："a" 与 "A"、尾空格均判为编辑', () => {
    expect(signatures(opsOf(['a'], ['A']))).toBe('DI');
    expect(signatures(opsOf(['A '], ['A']))).toBe('DI');
    expect(signatures(opsOf([' A'], ['A']))).toBe('DI');
    expect(signatures(opsOf(['A B'], ['A  B']))).toBe('DI');
  });
});

describe('diffLines 汇总', () => {
  it('相同输入距离为零', () => {
    const r = diffLines(['相同', '内容'], ['相同', '内容']);
    expect(r.distance).toBe(0);
    expect(r.inserts).toBe(0);
    expect(r.deletes).toBe(0);
    expect(r.equals).toBe(2);
  });

  it('重复条款场景给出最少 1 次编辑且稳定删第 2 行', () => {
    const r = diffLines(['A', 'A'], ['A']);
    expect(r.distance).toBe(1);
    expect(r.deletes).toBe(1);
    expect(r.ops[1]).toMatchObject({ type: 'delete', oldLineNo: 2 });
  });

  it('多重复行不误判位置：["X","X","X"] -> ["X"] 删第 2、3 行', () => {
    const r = diffLines(['X', 'X', 'X'], ['X']);
    expect(r.distance).toBe(2);
    expect(r.ops.filter((o) => o.type === 'delete').map((o) => o.oldLineNo)).toEqual([2, 3]);
  });
});
