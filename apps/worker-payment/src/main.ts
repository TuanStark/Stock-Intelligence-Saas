import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log(
    '🚀 Worker Payment is running and actively listening to BullMQ "payment-process" queue.',
  );

  // Graceful Shutdown configurations
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`Received ${signal}, shutting down Payment Worker...`);
      await app.close();
      process.exit(0);
    });
  }
}

bootstrap();
