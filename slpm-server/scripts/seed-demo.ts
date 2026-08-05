// 手动种子：创建演示账号（demo@slpm.local / demo1234）+ 演示数据
// 用法：npm run seed:demo
import { seedDemoManual } from '../src/lib/seed.js';

try {
  await seedDemoManual();
} finally {
  await (await import('../src/lib/prisma.js')).prisma.$disconnect();
}
