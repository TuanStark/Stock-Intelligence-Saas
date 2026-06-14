import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { FinancialDataIngestor } from "./financial-data.ingestor";

interface FinancialIngestionJobPayload {
  instrumentId: string;
  symbol: string;
}

@Processor("financial-ingestion")
export class FinancialDataProcessor extends WorkerHost {
  private readonly logger = new Logger(FinancialDataProcessor.name);

  constructor(private readonly ingestor: FinancialDataIngestor) {
    super();
  }

  async process(job: Job<FinancialIngestionJobPayload>): Promise<any> {
    const { name, data } = job;
    const { instrumentId, symbol } = data;

    this.logger.log(
      `[Queue Worker] Processing financial ingestion job ${job.id} for ${symbol} (Action: ${name})...`,
    );

    try {
      if (name === "ingest-all") {
        await this.ingestor.ingestAllSegments(instrumentId, symbol);
      } else if (name === "ingest-profile") {
        await this.ingestor.ingestProfile(instrumentId, symbol);
      } else if (name === "ingest-shareholders") {
        await this.ingestor.ingestShareholders(instrumentId, symbol);
      } else if (name === "ingest-dividends") {
        await this.ingestor.ingestDividends(instrumentId, symbol);
      } else if (name === "ingest-financials") {
        await this.ingestor.ingestFinancials(instrumentId, symbol);
      } else {
        this.logger.warn(`Unknown job name: ${name}`);
        return { success: false, reason: "unknown_job" };
      }

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to ingest financial data for ${symbol}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error; // Re-throw to allow BullMQ retry/fail status
    }
  }
}
