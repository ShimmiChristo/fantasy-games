-- CreateTable
CREATE TABLE "Prop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prop_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropOption_propId_fkey" FOREIGN KEY ("propId") REFERENCES "Prop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropPick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "propId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PropPick_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropPick_propId_fkey" FOREIGN KEY ("propId") REFERENCES "Prop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropPick_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PropOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Prop_boardId_idx" ON "Prop"("boardId");

-- CreateIndex
CREATE INDEX "PropOption_propId_idx" ON "PropOption"("propId");

-- CreateIndex
CREATE UNIQUE INDEX "PropOption_propId_label_key" ON "PropOption"("propId", "label");

-- CreateIndex
CREATE INDEX "PropPick_boardId_idx" ON "PropPick"("boardId");

-- CreateIndex
CREATE INDEX "PropPick_userId_idx" ON "PropPick"("userId");

-- CreateIndex
CREATE INDEX "PropPick_optionId_idx" ON "PropPick"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PropPick_propId_userId_key" ON "PropPick"("propId", "userId");
