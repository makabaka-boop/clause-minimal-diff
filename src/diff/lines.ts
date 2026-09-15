/**
 * 文本按行切分：区分大小写、保留空白，只以 \n 为分隔符（\r 视为行内容）。
 * 空文本视为 0 行；末尾换行不产生多余的空行。
 */
export function toLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** UTF-16 码元数（即 JS string.length） */
export function utf16Length(line: string): number {
  return line.length;
}
