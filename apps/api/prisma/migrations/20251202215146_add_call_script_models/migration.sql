-- CreateTable
CREATE TABLE "CallScript" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "entryNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallScriptNode" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "label" TEXT,
    "content" TEXT NOT NULL,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallScriptNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallScriptOption" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nextNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallScriptOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallScriptRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallScriptRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallScriptRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallScriptRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallScript_organizationId_purpose_isActive_idx" ON "CallScript"("organizationId", "purpose", "isActive");

-- CreateIndex
CREATE INDEX "CallScriptNode_scriptId_idx" ON "CallScriptNode"("scriptId");

-- CreateIndex
CREATE INDEX "CallScriptOption_nodeId_idx" ON "CallScriptOption"("nodeId");

-- CreateIndex
CREATE INDEX "CallScriptOption_nextNodeId_idx" ON "CallScriptOption"("nextNodeId");

-- CreateIndex
CREATE INDEX "CallScriptRun_organizationId_leadId_idx" ON "CallScriptRun"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "CallScriptRun_scriptId_idx" ON "CallScriptRun"("scriptId");

-- CreateIndex
CREATE INDEX "CallScriptRun_agentId_idx" ON "CallScriptRun"("agentId");

-- CreateIndex
CREATE INDEX "CallScriptRunStep_runId_idx" ON "CallScriptRunStep"("runId");

-- CreateIndex
CREATE INDEX "CallScriptRunStep_nodeId_idx" ON "CallScriptRunStep"("nodeId");

-- CreateIndex
CREATE INDEX "CallScriptRunStep_optionId_idx" ON "CallScriptRunStep"("optionId");

-- AddForeignKey
ALTER TABLE "CallScript" ADD CONSTRAINT "CallScript_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptNode" ADD CONSTRAINT "CallScriptNode_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CallScript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptOption" ADD CONSTRAINT "CallScriptOption_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CallScriptNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptRun" ADD CONSTRAINT "CallScriptRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptRun" ADD CONSTRAINT "CallScriptRun_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CallScript"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptRun" ADD CONSTRAINT "CallScriptRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptRun" ADD CONSTRAINT "CallScriptRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallScriptRunStep" ADD CONSTRAINT "CallScriptRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CallScriptRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
