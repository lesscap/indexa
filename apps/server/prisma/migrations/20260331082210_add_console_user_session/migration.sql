-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "passwordHashed" VARCHAR(128) NOT NULL,
    "passwordSalt" VARCHAR(64) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_domainId_disabled_idx" ON "User"("domainId", "disabled");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
