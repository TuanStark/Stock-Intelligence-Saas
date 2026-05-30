-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "management" JSONB NOT NULL,
    "charter_capital" DECIMAL(24,8) NOT NULL,
    "outstanding_shares" BIGINT NOT NULL,
    "beta" DECIMAL(5,2) NOT NULL,
    "eps" DECIMAL(24,8) NOT NULL,
    "pe" DECIMAL(10,2) NOT NULL,
    "pb" DECIMAL(10,2) NOT NULL,
    "dividend_yield" DECIMAL(5,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_shareholders" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shares" BIGINT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "is_foreign" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_shareholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_dividends" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "ex_date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "value" DECIMAL(24,8),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_financial_quarters" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "revenue" DECIMAL(24,8) NOT NULL,
    "gross_profit" DECIMAL(24,8) NOT NULL,
    "net_profit" DECIMAL(24,8) NOT NULL,
    "roe" DECIMAL(5,2),
    "roa" DECIMAL(5,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_financial_quarters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_financial_years" (
    "id" TEXT NOT NULL,
    "instrument_id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "revenue" DECIMAL(24,8) NOT NULL,
    "gross_profit" DECIMAL(24,8) NOT NULL,
    "net_profit" DECIMAL(24,8) NOT NULL,
    "roe" DECIMAL(5,2) NOT NULL,
    "roa" DECIMAL(5,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_profiles_instrument_id_key" ON "company_profiles"("instrument_id");

-- CreateIndex
CREATE INDEX "company_shareholders_instrument_id_idx" ON "company_shareholders"("instrument_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_shareholders_instrument_id_name_key" ON "company_shareholders"("instrument_id", "name");

-- CreateIndex
CREATE INDEX "company_dividends_instrument_id_idx" ON "company_dividends"("instrument_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_dividends_instrument_id_ex_date_type_key" ON "company_dividends"("instrument_id", "ex_date", "type");

-- CreateIndex
CREATE INDEX "company_financial_quarters_instrument_id_idx" ON "company_financial_quarters"("instrument_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_financial_quarters_instrument_id_quarter_key" ON "company_financial_quarters"("instrument_id", "quarter");

-- CreateIndex
CREATE INDEX "company_financial_years_instrument_id_idx" ON "company_financial_years"("instrument_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_financial_years_instrument_id_year_key" ON "company_financial_years"("instrument_id", "year");

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_shareholders" ADD CONSTRAINT "company_shareholders_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_dividends" ADD CONSTRAINT "company_dividends_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_financial_quarters" ADD CONSTRAINT "company_financial_quarters_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_financial_years" ADD CONSTRAINT "company_financial_years_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
