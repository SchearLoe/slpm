import { test, expect, Page } from '@playwright/test';

/**
 * SLPM 冒烟测试：注册/登录 → 任务创建 → 日程创建 → 设置页。
 * 每个测试独立注册唯一账号（Playwright 每次运行会重载模块，跨测试共享状态不可靠）。
 * 前置：后端 8080 + 前端 3000 已启动。
 */
const PASSWORD = 'e2e1234';

let seq = 0;
function uniqueEmail(): string {
  seq += 1;
  return `e2e_${Date.now().toString(36)}_${seq}@test.local`;
}

async function register(page: Page, email: string, name: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await page.getByPlaceholder('姓名（可选）').fill(name);
  await page.getByPlaceholder('邮箱').fill(email);
  await page.getByPlaceholder(/密码/).fill(PASSWORD);
  await page.getByRole('button', { name: '创建账号' }).click();
  // 注册成功 → 跳转到工作区页面
  await page.waitForURL(/\/tasks|\/overview|\/product/, { timeout: 15000 });
}

test.describe('SLPM 冒烟', () => {
  test('注册 → 创建任务 → 任务出现在看板', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email, 'E2E冒烟1');

    // 新建任务（TopBar「新增任务」展开子菜单 → 「新建任务」）
    await page.goto('/tasks');
    await page.getByRole('button', { name: '新增任务' }).click();
    await page.getByRole('button', { name: '新建任务' }).click();
    await page.getByPlaceholder('请输入任务标题...').fill('E2E 冒烟任务');
    await page.getByRole('button', { name: '立即创建' }).click();
    // 任务卡片出现在看板（需求评审组）
    await expect(page.getByText('E2E 冒烟任务').first()).toBeVisible({ timeout: 10000 });
  });

  test('注册 → 创建日程并出现在日程列表', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email, 'E2E冒烟2');

    await page.goto('/schedule');
    // 打开新建日程（「预约新日程」按钮）
    await page.getByRole('button', { name: '预约新日程' }).first().click();
    await page.getByPlaceholder('请输入会议主题').fill('E2E 冒烟会议');
    await page.getByRole('button', { name: '确认创建' }).click();
    await expect(page.getByText('E2E 冒烟会议').first()).toBeVisible({ timeout: 10000 });
  });

  test('注册 → 设置页系统 tab 正常渲染', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, email, 'E2E冒烟3');

    await page.goto('/settings');
    await page.getByRole('button', { name: '外观主题' }).click();
    await expect(page.getByText('外观主题')).toBeVisible();
    await page.getByRole('button', { name: '系统与数据' }).click();
    await expect(page.getByText('本地缓存')).toBeVisible();
  });
});
