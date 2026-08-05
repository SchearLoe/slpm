/**
 * P1-2 一次性数据迁移脚本：为每个 User 建默认工作区 + admin 成员记录，
 * 并把该用户的所有 Task/Schedule 归入此工作区。
 *
 * 运行：npx tsx prisma/db_scripts/backfill_workspaces.ts
 *
 * 幂等：重复运行不会重复创建（用 upsert + 跳过已填充的行）。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      ownedTasks: { where: { workspaceId: null }, select: { id: true } },
      schedules: { where: { workspaceId: null }, select: { id: true } },
    },
  });

  console.log(`发现 ${users.length} 个用户待处理`);

  for (const user of users) {
    // 1. 为该用户建默认工作区（slug 用 cuid 保证唯一，name 固定「我的工作区」）
    const slug = `ws_${user.id}`;
    const workspace = await prisma.workspace.upsert({
      where: { slug },
      update: {},
      create: { name: '我的工作区', slug },
    });

    // 2. 建 admin 成员记录（如已存在则跳过）
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: {},
      create: { workspaceId: workspace.id, userId: user.id, role: 'admin' },
    });

    // 3. 把该用户的所有未归属任务/日程填上 workspaceId
    if (user.ownedTasks.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: user.ownedTasks.map((t) => t.id) } },
        data: { workspaceId: workspace.id },
      });
    }
    if (user.schedules.length > 0) {
      await prisma.scheduleEvent.updateMany({
        where: { id: { in: user.schedules.map((s) => s.id) } },
        data: { workspaceId: workspace.id },
      });
    }

    console.log(
      `✓ ${user.email}: 工作区「${workspace.name}」(${workspace.id}), ` +
        `${user.ownedTasks.length} 任务 + ${user.schedules.length} 日程已归属`,
    );
  }

  // 校验：确认无 NULL workspaceId 残留
  const nullTasks = await prisma.task.count({ where: { workspaceId: null } });
  const nullSchedules = await prisma.scheduleEvent.count({ where: { workspaceId: null } });
  console.log(`\n校验：残留 NULL workspaceId → 任务 ${nullTasks}，日程 ${nullSchedules}`);
  if (nullTasks > 0 || nullSchedules > 0) {
    console.warn('⚠️  仍有未归属数据，请检查是否有无 owner 的孤儿任务/日程');
  } else {
    console.log('✅ 全部数据已归属，可安全将 workspaceId 改为 NOT NULL');
  }
}

main()
  .catch((e) => {
    console.error('❌ backfill 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
