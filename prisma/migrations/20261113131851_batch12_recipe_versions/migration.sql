/*
  Warnings:

  - You are about to drop the `RecipeLine` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RecipeLine" DROP CONSTRAINT "RecipeLine_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeLine" DROP CONSTRAINT "RecipeLine_variantId_fkey";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "recipeVersionId" TEXT;

-- DropTable
DROP TABLE "RecipeLine";

-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersionLine" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityBase" INTEGER NOT NULL,

    CONSTRAINT "RecipeVersionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_variantId_version_key" ON "RecipeVersion"("variantId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersionLine_recipeVersionId_inventoryItemId_key" ON "RecipeVersionLine"("recipeVersionId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersionLine" ADD CONSTRAINT "RecipeVersionLine_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersionLine" ADD CONSTRAINT "RecipeVersionLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
