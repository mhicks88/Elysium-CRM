-- CreateEnum
CREATE TYPE "EnrollmentJourneyStage" AS ENUM ('NOT_STARTED', 'DISCOVERY', 'UNDER_REVIEW', 'PENDING_DOCS', 'ENROLLED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "EnrollmentJourney" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "stage" "EnrollmentJourneyStage" NOT NULL,
    "notes" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrollmentJourney_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EnrollmentJourney" ADD CONSTRAINT "EnrollmentJourney_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentJourney" ADD CONSTRAINT "EnrollmentJourney_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentJourney" ADD CONSTRAINT "EnrollmentJourney_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
