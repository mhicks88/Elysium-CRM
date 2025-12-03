-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'DIRECTOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "directorId" TEXT,
ADD COLUMN     "managerId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
