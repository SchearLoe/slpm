-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "estimatedHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "notifyAssign" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyDeadline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyMention" BOOLEAN NOT NULL DEFAULT true;
