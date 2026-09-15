import { utf16Length } from './lines';

export const MAX_LINES = 2000;
export const MAX_CODE_UNITS = 500;

export interface SideViolation {
  /** 首个违规行号（1 起）：超长为该行；行数超限为第 MAX_LINES+1 行 */
  lineNo: number;
  tooLong: boolean;
  tooMany: boolean;
}

export interface ValidationResult {
  ok: boolean;
  old: SideViolation | null;
  new: SideViolation | null;
}

function checkSide(lines: string[]): SideViolation | null {
  // 按行号顺序报告首个违规：
  // 先在允许的前 MAX_LINES 行内查找首个超长行；
  // 前 2000 行都合法但总行数更多时，首个违规恒为第 2001 行（行数超限），
  // 不会跳到第 2001 行之后才出现的超长行。
  const scanLimit = Math.min(lines.length, MAX_LINES);
  for (let i = 0; i < scanLimit; i++) {
    if (utf16Length(lines[i]) > MAX_CODE_UNITS) {
      return { lineNo: i + 1, tooLong: true, tooMany: false };
    }
  }
  if (lines.length > MAX_LINES) {
    return { lineNo: MAX_LINES + 1, tooLong: false, tooMany: true };
  }
  return null;
}

export function validate(oldLines: string[], newLines: string[]): ValidationResult {
  const old = checkSide(oldLines);
  const nev = checkSide(newLines);
  return { ok: old === null && nev === null, old, new: nev };
}
