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
  for (let i = 0; i < lines.length; i++) {
    if (utf16Length(lines[i]) > MAX_CODE_UNITS) {
      // 超长行优先于行数超限报告（取最先遇到的违规）
      return { lineNo: i + 1, tooLong: true, tooMany: false };
    }
  }
  if (lines.length > MAX_LINES) {
    // 第 2001 行起即为首个违规行
    return { lineNo: MAX_LINES + 1, tooLong: false, tooMany: true };
  }
  return null;
}

export function validate(oldLines: string[], newLines: string[]): ValidationResult {
  const old = checkSide(oldLines);
  const nev = checkSide(newLines);
  return { ok: old === null && nev === null, old, new: nev };
}
