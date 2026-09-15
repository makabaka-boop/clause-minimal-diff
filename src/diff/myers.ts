/**
 * Myers 最短编辑脚本（Myers, 1986）——按行比较。
 *
 * 约定：
 *   x、y 为已消费的行数，k = x - y，d 为编辑路径长度。
 *   d = 0 时先贪心匹配（沿对角线的相同行前进）。
 *   此后每一层按 k 递增搜索：
 *     - 边界 k = -d 选插入；k = d 选删除；
 *     - 中间当 V[k-1] < V[k+1] 时选插入，否则选删除；
 *     - 随后沿相同行贪心前进。
 *   保存每一层的 V，到达右下角后反向回溯出编辑脚本。
 *
 * 比较为区分大小写且保留空白的整行严格相等（===）。
 */

export type DiffOpType = 'equal' | 'insert' | 'delete';

export interface DiffOp {
  type: DiffOpType;
  /** 旧版（左侧）原行号，从 1 开始；insert 行为 null */
  oldLineNo: number | null;
  /** 新版（右侧）原行号，从 1 开始；delete 行为 null */
  newLineNo: number | null;
  text: string;
}

export interface DiffResult {
  /** 最少编辑次数（插入 + 删除） */
  distance: number;
  ops: DiffOp[];
  inserts: number;
  deletes: number;
  equals: number;
}

/**
 * 一层 V 数组：以 k 为键、x 为值，保存该层搜索结束（贪心之后）的端点。
 * 内部用偏移量把可能为负的 k 映射为数组下标。
 */
export interface TraceLayer {
  /** 读取该层 V[k]；越界或该层不存在此 k 时返回 undefined */
  get(k: number): number | undefined;
}

export interface Trace {
  layers: TraceLayer[];
  endX: number;
  endY: number;
}

class VLayer {
  private readonly offset: number;
  private readonly cells: number[] = [];

  constructor(d: number) {
    // k 取值范围为 [-d, d]，映射到下标 [0, 2d]
    this.offset = d;
  }

  get(k: number): number | undefined {
    const value = this.cells[k + this.offset];
    return value === undefined ? undefined : value;
  }

  set(k: number, x: number): void {
    this.cells[k + this.offset] = x;
  }
}

/**
 * 回溯时判断上一步的 k：返回 true 表示该步为插入（向下，k 减 1），
 * false 表示该步为删除（向右，k 加 1）。
 *
 * 边界：k === -d 只能插入；k === d 只能删除。
 * 中间：V[k-1] < V[k+1] 时插入，否则删除（相等时取删除，保证
 * 重复行场景下稳定删除靠后的旧版行）。
 */
export function previousKIsInsert(
  layer: TraceLayer,
  k: number,
  d: number,
): boolean {
  if (k === -d) return true;
  if (k === d) return false;
  const down = layer.get(k - 1); // 插入来源端点的 x
  const right = layer.get(k + 1); // 删除来源端点的 x
  return (down ?? -1) < (right ?? -1);
}

/**
 * 前向搜索：逐层填充 V，并保存每一层用于回溯。
 */
export function buildTrace(oldLines: string[], newLines: string[]): Trace {
  const n = oldLines.length;
  const m = newLines.length;
  const max = n + m;
  const layers: TraceLayer[] = [];

  for (let d = 0; d <= max; d++) {
    const layer = new VLayer(d);

    if (d === 0) {
      // d=0：从 (0,0) 出发先贪心匹配
      let x = 0;
      let y = 0;
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x++;
        y++;
      }
      layer.set(0, x);
    } else {
      const prev = layers[d - 1];
      for (let k = -d; k <= d; k += 2) {
        let x: number;
        if (k === -d) {
          x = (prev.get(k + 1) ?? 0); // 插入：k 由 k+1 减 1
        } else if (k === d) {
          x = (prev.get(k - 1) ?? 0) + 1; // 删除：k 由 k-1 加 1
        } else if ((prev.get(k - 1) ?? -1) < (prev.get(k + 1) ?? -1)) {
          // 中间：V[k-1] < V[k+1] 选插入
          x = prev.get(k + 1) ?? 0;
        } else {
          // 否则选删除
          x = (prev.get(k - 1) ?? 0) + 1;
        }
        let y = x - k;
        // 沿相同行贪心前进
        while (x < n && y < m && oldLines[x] === newLines[y]) {
          x++;
          y++;
        }
        layer.set(k, x);
      }
    }

    layers.push(layer);

    if (layer.get(n - m) === n) {
      // 到达右下角 (n, m)
      return { layers, endX: n, endY: m };
    }
  }

  throw new Error('Myers 搜索未能到达终点');
}

/**
 * 反向回溯：利用保存的各层 V 还原最短编辑脚本（正序）。
 */
export function backtrack(
  oldLines: string[],
  newLines: string[],
  trace: Trace,
): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = trace.endX;
  let y = trace.endY;

  for (let d = trace.layers.length - 1; d > 0; d--) {
    const layer = trace.layers[d - 1];
    const k = x - y;
    const insert = previousKIsInsert(layer, k, d);

    const prevK = insert ? k + 1 : k - 1;
    const prevX = layer.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    // 先回退对角线（相同行）
    while (x > prevX + (insert ? 0 : 1) && y > prevY + (insert ? 1 : 0)) {
      x--;
      y--;
      ops.push({
        type: 'equal',
        oldLineNo: x + 1,
        newLineNo: y + 1,
        text: oldLines[x],
      });
    }

    if (insert) {
      y--;
      ops.push({ type: 'insert', oldLineNo: null, newLineNo: y + 1, text: newLines[y] });
    } else {
      x--;
      ops.push({ type: 'delete', oldLineNo: x + 1, newLineNo: null, text: oldLines[x] });
    }
  }

  // d=0 层上剩余的对角线
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({
      type: 'equal',
      oldLineNo: x + 1,
      newLineNo: y + 1,
      text: oldLines[x],
    });
  }

  return ops.reverse();
}

/**
 * 对两份按行切分的文本求最短编辑脚本。
 */
export function diffLines(oldLines: string[], newLines: string[]): DiffResult {
  const trace = buildTrace(oldLines, newLines);
  const ops = backtrack(oldLines, newLines, trace);

  let inserts = 0;
  let deletes = 0;
  let equals = 0;
  for (const op of ops) {
    if (op.type === 'insert') inserts++;
    else if (op.type === 'delete') deletes++;
    else equals++;
  }

  return { distance: inserts + deletes, ops, inserts, deletes, equals };
}
