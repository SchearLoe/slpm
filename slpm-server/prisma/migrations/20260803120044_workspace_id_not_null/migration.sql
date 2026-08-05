/*
  Warnings:

  - Made the column `workspaceId` on table `ScheduleEvent` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workspaceId` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ScheduleEvent" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "workspaceId" SET NOT NULL;
