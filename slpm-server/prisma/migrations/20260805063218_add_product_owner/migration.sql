/*
  Warnings:

  - Added the required column `ownerId` to the `Product` table without a default value. This is not possible if the table is not empty.

  Manual fix: 先加可空列 → 用首位用户回填存量行 → 再收紧为 NOT NULL
*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ownerId" TEXT;

-- Backfill: 存量产品行归属到第一个用户（迁移前的测试数据）
UPDATE "Product" SET "ownerId" = (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1) WHERE "ownerId" IS NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "ownerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
