import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('默认场景即重复行证据：旧版 A/A 对新版 A 稳定删除旧版第 2 行', async ({ page }) => {
  await expect(page.locator('[data-testid="old-input"]')).toHaveValue('A\nA');
  await expect(page.locator('[data-testid="new-input"]')).toHaveValue('A');

  await expect(page.locator('[data-testid="distance"]')).toHaveText('1');
  await expect(page.locator('[data-testid="deletes"]')).toHaveText('1');
  await expect(page.locator('[data-testid="inserts"]')).toHaveText('0');
  await expect(page.locator('[data-testid="blocks"]')).toHaveText('1');

  // 被删除的必须是旧版第 2 行（原行号），而不是第 1 行
  const deleteRows = page.locator('[data-kind="delete"]');
  await expect(deleteRows).toHaveCount(1);
  await expect(deleteRows.locator('[data-testid="delete-gutter"]')).toHaveText('2');
  await expect(deleteRows.locator('[data-testid="delete-text"]')).toHaveText('A');

  // 保留下来的相同行仍是旧版第 1 行 = 新版第 1 行
  const equalRows = page.locator('[data-kind="equal"]');
  await expect(equalRows).toHaveCount(1);
});

test('多份重复条款时普通对照的错位不会发生：X/X/X 对 X 删第 2、3 行', async ({ page }) => {
  await page.locator('[data-testid="old-input"]').fill('X\nX\nX');
  await page.locator('[data-testid="new-input"]').fill('X');

  await expect(page.locator('[data-testid="distance"]')).toHaveText('2');
  const gutters = page.locator('[data-kind="delete"] [data-testid="delete-gutter"]');
  await expect(gutters).toHaveText(['2', '3']);
});

test('相同输入必须为零编辑且无变更块', async ({ page }) => {
  await page.locator('[data-testid="old-input"]').fill('第 1 条\n第 2 条\n第 2 条');
  await page.locator('[data-testid="new-input"]').fill('第 1 条\n第 2 条\n第 2 条');

  await expect(page.locator('[data-testid="distance"]')).toHaveText('0');
  await expect(page.locator('[data-testid="blocks"]')).toHaveText('0');
  await expect(page.locator('[data-testid="change-block"]')).toHaveCount(0);
  await expect(page.locator('[data-kind="equal"]')).toHaveCount(3);
});

test('区分大小写、保留空白：尾空格与大小写差异都计入编辑', async ({ page }) => {
  await page.locator('[data-testid="old-input"]').fill('abc ');
  await page.locator('[data-testid="new-input"]').fill('abc');
  await expect(page.locator('[data-testid="distance"]')).toHaveText('2');

  await page.locator('[data-testid="old-input"]').fill('abc');
  await page.locator('[data-testid="new-input"]').fill('ABC');
  await expect(page.locator('[data-testid="distance"]')).toHaveText('2');
});

test('超限时同时列出两侧首个违规行号并清空旧结果', async ({ page }) => {
  // 先制造一个合法结果
  await page.locator('[data-testid="old-input"]').fill('A\nA');
  await page.locator('[data-testid="new-input"]').fill('A');
  await expect(page.locator('[data-testid="distance"]')).toHaveText('1');

  // 旧版第 3 行超长；新版第 1 行超长（用 JS length，即 UTF-16 码元）
  const longLine = '字'.repeat(501);
  await page.locator('[data-testid="old-input"]').fill(`A\nB\n${longLine}`);
  await page.locator('[data-testid="new-input"]').fill(longLine);

  const errors = page.locator('[data-testid="errors"]');
  await expect(errors).toBeVisible();
  await expect(page.locator('[data-testid="old-error"]')).toContainText('旧版第 3 行');
  await expect(page.locator('[data-testid="old-error"]')).toContainText('500');
  await expect(page.locator('[data-testid="new-error"]')).toContainText('新版第 1 行');

  // 旧结果必须被清空：统计与差异区都不在
  await expect(page.locator('[data-testid="stats"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="diff"]')).toHaveCount(0);

  // 恢复合法输入后结果重新出现
  await page.locator('[data-testid="old-input"]').fill('A\nA');
  await page.locator('[data-testid="new-input"]').fill('A');
  await expect(errors).toHaveCount(0);
  await expect(page.locator('[data-testid="distance"]')).toHaveText('1');
});

test('行数超限时提示首个违规行号 2001 并清空结果', async ({ page }) => {
  const many = Array.from({ length: 2001 }, (_, i) => `L${i}`).join('\n');
  await page.locator('[data-testid="old-input"]').fill(many);
  await page.locator('[data-testid="new-input"]').fill('L0');

  await expect(page.locator('[data-testid="old-error"]')).toContainText('旧版第 2001 行起超过 2000 行');
  await expect(page.locator('[data-testid="stats"]')).toHaveCount(0);
});

test('超过 2000 行且更后的行又超长时，仍指向第 2001 行而非后面的超长行', async ({ page }) => {
  const lines = Array.from({ length: 2005 }, (_, i) => `L${i}`);
  lines[2004] = '字'.repeat(501); // 第 2005 行超长
  await page.locator('[data-testid="old-input"]').fill(lines.join('\n'));
  await page.locator('[data-testid="new-input"]').fill('L0');

  // 必须报第 2001 行（行数超限），而不是第 2005 行（超长）
  await expect(page.locator('[data-testid="old-error"]')).toContainText('旧版第 2001 行起超过 2000 行');
  await expect(page.locator('[data-testid="old-error"]')).not.toContainText('第 2005 行');
  await expect(page.locator('[data-testid="stats"]')).toHaveCount(0);
});
