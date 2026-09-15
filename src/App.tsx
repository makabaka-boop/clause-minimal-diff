import { useMemo, useState } from 'react';
import { diffLines } from './diff/myers';
import { buildView, formatRange } from './diff/blocks';
import { toLines } from './diff/lines';
import { MAX_CODE_UNITS, MAX_LINES, validate } from './diff/validate';
import './App.css';

const DEFAULT_OLD = 'A\nA';
const DEFAULT_NEW = 'A';

function violationText(side: string, v: { lineNo: number; tooLong: boolean; tooMany: boolean }): string {
  if (v.tooLong) {
    return `${side}第 ${v.lineNo} 行超过 ${MAX_CODE_UNITS} 个 UTF-16 码元`;
  }
  return `${side}第 ${v.lineNo} 行起超过 ${MAX_LINES} 行上限`;
}

export default function App() {
  const [oldText, setOldText] = useState(DEFAULT_OLD);
  const [newText, setNewText] = useState(DEFAULT_NEW);

  const model = useMemo(() => {
    const oldLines = toLines(oldText);
    const newLines = toLines(newText);
    const validation = validate(oldLines, newLines);
    if (!validation.ok) {
      // 超限：同时列出各侧首个违规行号，并清空旧结果
      return { valid: false as const, oldLineCount: oldLines.length, newLineCount: newLines.length, validation };
    }
    const result = diffLines(oldLines, newLines);
    const view = buildView(result.ops);
    const blocks = view.filter((item) => item.kind === 'change').length;
    return { valid: true as const, oldLineCount: oldLines.length, newLineCount: newLines.length, result, view, blocks };
  }, [oldText, newText]);

  return (
    <div className="page">
      <header className="app-header">
        <h1>双栏校勘器</h1>
        <p className="subtitle">
          按行比较 · 区分大小写 · 保留空白 · Myers 最短编辑脚本 · 仅在浏览器内运行
        </p>
      </header>

      <section className="editors" aria-label="输入">
        <div className="editor-pane">
          <div className="pane-title">
            <span>旧版（左）</span>
            <span className="line-count" data-testid="old-count">{model.oldLineCount} 行</span>
          </div>
          <textarea
            data-testid="old-input"
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            spellCheck={false}
            wrap="off"
            aria-label="旧版文本"
          />
        </div>
        <div className="editor-pane">
          <div className="pane-title">
            <span>新版（右）</span>
            <span className="line-count" data-testid="new-count">{model.newLineCount} 行</span>
          </div>
          <textarea
            data-testid="new-input"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            spellCheck={false}
            wrap="off"
            aria-label="新版文本"
          />
        </div>
      </section>

      <p className="limits">
        限制：每侧最多 {MAX_LINES.toLocaleString()} 行，每行最多 {MAX_CODE_UNITS} 个 UTF-16 码元。
      </p>

      {!model.valid ? (
        <div className="errors" role="alert" data-testid="errors">
          <strong>输入超限，已清空旧结果：</strong>
          <ul>
            {model.validation.old && (
              <li data-testid="old-error">{violationText('旧版', model.validation.old)}</li>
            )}
            {model.validation.new && (
              <li data-testid="new-error">{violationText('新版', model.validation.new)}</li>
            )}
          </ul>
        </div>
      ) : (
        <section className="result" aria-label="校勘结果">
          <div className="stats" data-testid="stats">
            <span>最少编辑次数：<strong data-testid="distance">{model.result.distance}</strong></span>
            <span>删除：<strong data-testid="deletes">{model.result.deletes}</strong></span>
            <span>插入：<strong data-testid="inserts">{model.result.inserts}</strong></span>
            <span>连续变更块：<strong data-testid="blocks">{model.blocks}</strong></span>
          </div>

          <div className="diff" data-testid="diff">
            <div className="diff-grid">
              <div className="diff-corner">旧版行号</div>
              <div className="diff-corner">旧版内容</div>
              <div className="diff-corner">新版行号</div>
              <div className="diff-corner">新版内容</div>

              {model.view.map((item, i) =>
                item.kind === 'equal' ? (
                  <div className="grid-row" key={`e-${i}`} data-kind="equal">
                    <div className="gutter">{item.oldLineNo}</div>
                    <pre className="cell">{item.text}</pre>
                    <div className="gutter">{item.newLineNo}</div>
                    <pre className="cell">{item.text}</pre>
                  </div>
                ) : (
                  <div className="block" key={`b-${item.block.index}`} data-testid="change-block">
                    <div className="block-banner">
                      变更块 #{item.block.index}：旧版第 {formatRange(item.block.oldStart, item.block.oldEnd)} 行
                      → 新版第 {formatRange(item.block.newStart, item.block.newEnd)} 行
                      （删 {item.block.deletes.length} / 增 {item.block.inserts.length}，删除紧邻插入）
                    </div>
                    {item.block.deletes.map((op) => (
                      <div className="grid-row row-delete" key={`d-${op.oldLineNo}`} data-kind="delete">
                        <div className="gutter" data-testid="delete-gutter">{op.oldLineNo}</div>
                        <pre className="cell" data-testid="delete-text">{op.text}</pre>
                        <div className="gutter" />
                        <pre className="cell cell-empty" />
                      </div>
                    ))}
                    {item.block.inserts.map((op) => (
                      <div className="grid-row row-insert" key={`i-${op.newLineNo}`} data-kind="insert">
                        <div className="gutter" />
                        <pre className="cell cell-empty" />
                        <div className="gutter" data-testid="insert-gutter">{op.newLineNo}</div>
                        <pre className="cell" data-testid="insert-text">{op.text}</pre>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
