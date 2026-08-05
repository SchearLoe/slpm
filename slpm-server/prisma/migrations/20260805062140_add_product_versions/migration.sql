-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "productVersionId" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "startDate" TIMESTAMP(3),
    "releaseDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "ProductVersion_productId_idx" ON "ProductVersion"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_productId_name_key" ON "ProductVersion"("productId", "name");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
