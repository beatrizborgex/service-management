-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('ENTRADA', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "lastServiceOrderNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "deviceBrand" TEXT NOT NULL,
    "deviceModel" TEXT NOT NULL,
    "deviceColor" TEXT,
    "accessories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "devicePasswordEncrypted" TEXT,
    "reportedProblem" TEXT NOT NULL,
    "diagnosis" TEXT,
    "estimatedPrice" DECIMAL(10,2),
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'ENTRADA',
    "expectedDeliveryAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "warrantyDays" INTEGER,
    "qrCodeToken" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "previousServiceOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "fromStatus" "ServiceOrderStatus",
    "toStatus" "ServiceOrderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

-- CreateIndex
CREATE INDEX "Client_companyId_phone_idx" ON "Client"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_qrCodeToken_key" ON "ServiceOrder"("qrCodeToken");

-- CreateIndex
CREATE INDEX "ServiceOrder_companyId_status_idx" ON "ServiceOrder"("companyId", "status");

-- CreateIndex
CREATE INDEX "ServiceOrder_companyId_clientId_idx" ON "ServiceOrder"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "ServiceOrder_companyId_createdAt_idx" ON "ServiceOrder"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_previousServiceOrderId_idx" ON "ServiceOrder"("previousServiceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_companyId_number_key" ON "ServiceOrder"("companyId", "number");

-- CreateIndex
CREATE INDEX "ServiceOrderStatusHistory_serviceOrderId_createdAt_idx" ON "ServiceOrderStatusHistory"("serviceOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrderStatusHistory_changedByUserId_idx" ON "ServiceOrderStatusHistory"("changedByUserId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_previousServiceOrderId_fkey" FOREIGN KEY ("previousServiceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderStatusHistory" ADD CONSTRAINT "ServiceOrderStatusHistory_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderStatusHistory" ADD CONSTRAINT "ServiceOrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
