-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmbeddingProvider" AS ENUM ('QWEN');

-- CreateEnum
CREATE TYPE "EmbeddingProfileStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DistanceMetric" AS ENUM ('COSINE');

-- CreateEnum
CREATE TYPE "LibraryIndexStatus" AS ENUM ('QUEUED', 'RUNNING', 'ACTIVE', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentIndexStateStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "IndexJobType" AS ENUM ('INDEX_DOCUMENT', 'REINDEX_DOCUMENT');

-- CreateEnum
CREATE TYPE "IndexJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IndexJobStage" AS ENUM ('PARSING', 'CHUNKING', 'EMBEDDING', 'UPSERTING', 'FINALIZING');

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "status" "DomainStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "status" "LibraryStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeIndexId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" VARCHAR(64) NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddingProfile" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "provider" "EmbeddingProvider" NOT NULL,
    "model" VARCHAR(128) NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "distanceMetric" "DistanceMetric" NOT NULL DEFAULT 'COSINE',
    "configJson" JSONB,
    "status" "EmbeddingProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryIndex" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "embeddingProfileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "qdrantCollectionName" VARCHAR(191) NOT NULL,
    "chunkStrategy" VARCHAR(64) NOT NULL DEFAULT 'recursive_text',
    "chunkConfig" JSONB,
    "status" "LibraryIndexStatus" NOT NULL DEFAULT 'QUEUED',
    "activatedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentIndexState" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "libraryIndexId" TEXT NOT NULL,
    "status" "DocumentIndexStateStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "IndexJobStage",
    "lastIndexedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentIndexState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexJob" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "libraryIndexId" TEXT NOT NULL,
    "documentIndexStateId" TEXT NOT NULL,
    "type" "IndexJobType" NOT NULL,
    "status" "IndexJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "IndexJobStage",
    "progressCurrent" INTEGER,
    "progressTotal" INTEGER,
    "progressUnit" VARCHAR(32),
    "lockedAt" TIMESTAMP(3),
    "workerId" VARCHAR(128),
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "libraryIndexId" TEXT NOT NULL,
    "chunkNo" INTEGER NOT NULL,
    "textPath" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "tokenCount" INTEGER,
    "contentHash" VARCHAR(64) NOT NULL,
    "qdrantPointId" VARCHAR(191) NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_slug_key" ON "Domain"("slug");

-- CreateIndex
CREATE INDEX "Library_domainId_status_idx" ON "Library"("domainId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Library_domainId_slug_key" ON "Library"("domainId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storagePath_key" ON "Document"("storagePath");

-- CreateIndex
CREATE INDEX "Document_libraryId_createdAt_idx" ON "Document"("libraryId", "createdAt");

-- CreateIndex
CREATE INDEX "EmbeddingProfile_domainId_status_idx" ON "EmbeddingProfile"("domainId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingProfile_domainId_slug_key" ON "EmbeddingProfile"("domainId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIndex_qdrantCollectionName_key" ON "LibraryIndex"("qdrantCollectionName");

-- CreateIndex
CREATE INDEX "LibraryIndex_libraryId_status_idx" ON "LibraryIndex"("libraryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIndex_libraryId_version_key" ON "LibraryIndex"("libraryId", "version");

-- CreateIndex
CREATE INDEX "DocumentIndexState_libraryIndexId_status_idx" ON "DocumentIndexState"("libraryIndexId", "status");

-- CreateIndex
CREATE INDEX "DocumentIndexState_documentId_status_idx" ON "DocumentIndexState"("documentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentIndexState_documentId_libraryIndexId_key" ON "DocumentIndexState"("documentId", "libraryIndexId");

-- CreateIndex
CREATE INDEX "IndexJob_status_createdAt_idx" ON "IndexJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IndexJob_libraryId_createdAt_idx" ON "IndexJob"("libraryId", "createdAt");

-- CreateIndex
CREATE INDEX "IndexJob_documentId_idx" ON "IndexJob"("documentId");

-- CreateIndex
CREATE INDEX "IndexJob_documentIndexStateId_createdAt_idx" ON "IndexJob"("documentIndexStateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_qdrantPointId_key" ON "DocumentChunk"("qdrantPointId");

-- CreateIndex
CREATE INDEX "DocumentChunk_libraryIndexId_chunkNo_idx" ON "DocumentChunk"("libraryIndexId", "chunkNo");

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_libraryIndexId_idx" ON "DocumentChunk"("documentId", "libraryIndexId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_libraryIndexId_chunkNo_key" ON "DocumentChunk"("documentId", "libraryIndexId", "chunkNo");

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_activeIndexId_fkey" FOREIGN KEY ("activeIndexId") REFERENCES "LibraryIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddingProfile" ADD CONSTRAINT "EmbeddingProfile_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIndex" ADD CONSTRAINT "LibraryIndex_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIndex" ADD CONSTRAINT "LibraryIndex_embeddingProfileId_fkey" FOREIGN KEY ("embeddingProfileId") REFERENCES "EmbeddingProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentIndexState" ADD CONSTRAINT "DocumentIndexState_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentIndexState" ADD CONSTRAINT "DocumentIndexState_libraryIndexId_fkey" FOREIGN KEY ("libraryIndexId") REFERENCES "LibraryIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexJob" ADD CONSTRAINT "IndexJob_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexJob" ADD CONSTRAINT "IndexJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexJob" ADD CONSTRAINT "IndexJob_libraryIndexId_fkey" FOREIGN KEY ("libraryIndexId") REFERENCES "LibraryIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexJob" ADD CONSTRAINT "IndexJob_documentIndexStateId_fkey" FOREIGN KEY ("documentIndexStateId") REFERENCES "DocumentIndexState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_libraryIndexId_fkey" FOREIGN KEY ("libraryIndexId") REFERENCES "LibraryIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
