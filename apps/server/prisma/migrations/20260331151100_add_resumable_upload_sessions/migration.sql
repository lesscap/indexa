-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('CREATED', 'UPLOADING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "tusUploadId" VARCHAR(191) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "bytesReceived" BIGINT NOT NULL DEFAULT 0,
    "storagePath" TEXT NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'CREATED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_tusUploadId_key" ON "UploadSession"("tusUploadId");

-- CreateIndex
CREATE INDEX "UploadSession_libraryId_status_createdAt_idx" ON "UploadSession"("libraryId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UploadSession_domainId_createdAt_idx" ON "UploadSession"("domainId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadSession_createdByUserId_createdAt_idx" ON "UploadSession"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
