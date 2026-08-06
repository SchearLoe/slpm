import { prisma } from './prisma.js';
import { env } from '../config/env.js';

/**
 * P4-1：超级管理员初始化（服务启动时调用）。
 *
 * 当数据库没有任何 system_admin 时：
 *  - 若 .env 配置了 INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD → 创建该账号；
 *  - 否则随机生成密码并打印到控制台，供安装人员首次登录使用。
 * 幂等：已有 system_admin 则跳过。
 */
export async function ensureSystemAdmin(): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { role: 'system_admin' }, select: { email: true } });
  if (existing) return;

  const bcrypt = (await import('bcryptjs')).default;
  const email = env.initialAdminEmail ?? 'admin@slpm.local';
  const password = env.initialAdminPassword ?? randomPassword();

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name: '系统管理员',
      role: 'system_admin',
      settings: { create: {} },
    },
  });

  // P7 安全修复：明文密码不再打印到 stdout（防容器日志聚合泄露）。
  // 改为写入本地一次性文件 .admin-initial-password（仅安装人员可读，权限 0600）
  console.log('════════════════════════════════════════════');
  console.log('🛡 已初始化超级管理员账号（首次安装）');
  console.log(`   邮箱: ${email}`);
  if (env.initialAdminPassword) {
    console.log('   密码: 使用 .env 配置的 INITIAL_ADMIN_PASSWORD');
  } else {
    // 随机密码写入本地文件，不直接落 stdout
    const fs = await import('node:fs');
    const pwdFile = '.admin-initial-password';
    fs.writeFileSync(pwdFile, `邮箱: ${email}\n密码: ${password}\n（请立即登录并修改密码，然后删除此文件）\n`, { mode: 0o600 });
    console.log(`   随机密码已写入文件: ${pwdFile}（请查看后立即删除）`);
  }
  console.log('   ⚠ 请立即登录并修改密码！如需预设账号，可在 .env 配置');
  console.log('     INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD');
  console.log('════════════════════════════════════════════');
}

function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * P4-1：演示数据种子（首次使用教程指引）。
 *
 * 触发时机：
 *  1. 首个用户注册时（数据库尚无任何工作区）自动为 TA 创建「演示项目」工作区 + 示例数据；
 *  2. 安装人员可手动运行 `npm run seed:demo`（scripts/seed-demo.ts）为存量数据库补数据。
 *
 * 所有示例任务标题以「【示例】」前缀，方便辨识与清理。
 */
export async function seedDemoForUser(userId: string, userName: string): Promise<boolean> {
  // 已有任何工作区则跳过（避免重复/污染存量数据）
  const wsCount = await prisma.workspace.count();
  if (wsCount > 0) return false;

  const now = new Date();

  // 1. 演示工作区（归属创建者，创建者自动 admin）
  const workspace = await prisma.workspace.create({
    data: {
      name: '演示项目',
      slug: `demo_${Date.now().toString(36)}`,
      members: { create: { userId, role: 'admin' } },
    },
  });

  const days = (n: number) => new Date(now.getTime() + n * 24 * 3600 * 1000);

  // 2. 示例任务（覆盖四阶段 + 里程碑 + 依赖，形成甘特图与看板）
  const tasks = [
    { title: '【示例】需求评审：智能提醒功能', phase: '需求评审', priority: '高', status: '进行中', deadline: days(3), milestone: false },
    { title: '【示例】需求评审：报表导出增强', phase: '需求评审', priority: '中', status: '待处理', deadline: days(5), milestone: false },
    { title: '【示例】产品设计：交互原型 V2', phase: '产品设计', priority: '高', status: '进行中', deadline: days(7), milestone: false, startDate: days(1) },
    { title: '【示例】开发实现：通知中心联调', phase: '开发实现', priority: '中', status: '进行中', deadline: days(10), milestone: false, startDate: days(3) },
    { title: '【示例】测试验证：核心链路回归', phase: '测试验证', priority: '高', status: '待处理', deadline: days(12), milestone: false },
    { title: '【示例】里程碑：v1.0 版本发布', phase: '测试验证', priority: '高', status: '进行中', deadline: days(14), milestone: true, startDate: days(8) },
  ] as const;

  const created = [];
  for (const t of tasks) {
    const task = await prisma.task.create({
      data: {
        title: t.title,
        phase: t.phase,
        priority: t.priority,
        status: t.status,
        deadline: t.deadline,
        startDate: (t as { startDate?: Date }).startDate ?? null,
        milestone: t.milestone,
        tags: ['示例'],
        assigneeId: userId,
        ownerId: userId,
        workspaceId: workspace.id,
      },
    });
    created.push(task);
  }

  // 3. 示例日程（本月与下月各一条）
  const meeting1 = days(1);
  const meeting2 = days(3);
  await prisma.scheduleEvent.createMany({
    data: [
      { title: '【示例】周例会：产品进度同步', startTime: meeting1, endTime: new Date(meeting1.getTime() + 3600_000), priority: '中', attendees: [userName], status: '待开始', ownerId: userId, workspaceId: workspace.id },
      { title: '【示例】评审会：智能提醒需求', startTime: meeting2, endTime: new Date(meeting2.getTime() + 3600_000), priority: '高', attendees: [userName], status: '待开始', ownerId: userId, workspaceId: workspace.id },
    ],
  });

  // 4. 示例知识库文章
  await prisma.knowledgeArticle.createMany({
    data: [
      { title: '【示例】项目协作规范', body: '欢迎使用 SLPM！\n\n1. 任务按「需求评审 → 产品设计 → 开发实现 → 测试验证」四阶段流转；\n2. 在评论中用 @姓名 可提醒同事；\n3. 甘特图会自动按任务的开始/截止日期生成。', category: '团队流程', authorId: userId, workspaceId: workspace.id, views: 1 },
      { title: '【示例】质量保障基线', body: '核心链路必须通过测试验证阶段后才可以标记完成。', category: '质量保障', authorId: userId, workspaceId: workspace.id, views: 1 },
    ],
  });

  // 5. 示例通知（演示站内信入口）
  await prisma.notification.create({
    data: {
      userId,
      workspaceId: workspace.id,
      type: 'system',
      title: '欢迎使用 SLPM 🎉',
      body: '「演示项目」已为你准备好示例任务、日程与文档，可以去探索了！',
      read: false,
    },
  });

  return true;
}

/** 手动种子入口：创建演示账号 + 演示数据（幂等：已存在演示账号则跳过） */
export async function seedDemoManual() {
  const existing = await prisma.user.findUnique({ where: { email: 'demo@slpm.local' } });
  if (existing) {
    console.log('⚠️ 演示账号 demo@slpm.local 已存在，跳过（如需重置请先删除该用户）');
    return;
  }
  const bcrypt = (await import('bcryptjs')).default;
  const password = 'demo1234';
  const user = await prisma.user.create({
    data: {
      email: 'demo@slpm.local',
      passwordHash: await bcrypt.hash(password, 12),
      name: '演示用户',
      role: 'system_admin',
      settings: { create: {} },
    },
  });
  const seeded = await seedDemoForUser(user.id, user.name);
  console.log(seeded
    ? `✅ 演示数据已创建：账号 demo@slpm.local / ${password}（system_admin）`
    : '⚠️ 数据库已有工作区，跳过演示工作区创建（演示账号仍已创建）');
}
