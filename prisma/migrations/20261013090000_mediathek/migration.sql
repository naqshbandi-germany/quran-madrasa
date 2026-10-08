-- Mediathek: Lehrmaterial (PDFs u. a.), das Lehrer hochladen und per E-Mail verschicken.

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA,
    "blobPathname" TEXT,
    "blobUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaFile_ownerId_createdAt_idx" ON "MediaFile"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
