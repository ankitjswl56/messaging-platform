import * as amqp from 'amqplib';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { config } from './config/env';
import { getFileStream, uploadStream } from './services/minio';

const processZipJob = async (files: string[], jobId: string): Promise<string> => {
  const zipFileName = `zips/${jobId}.zip`;
  
  // PassThrough acts as a bridge between the archiver output and MinIO input
  const streamBridge = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(streamBridge);

  for (const file of files) {
    const fileStream = await getFileStream(file);
    archive.append(fileStream, { name: file });
  }

  archive.finalize();

  await uploadStream(zipFileName, streamBridge);

  return zipFileName;
};

const bootstrapWorker = async () => {
  try {
    const connection = await amqp.connect(config.rabbitmq.url);
    const channel = await connection.createChannel();

    await channel.assertQueue(config.rabbitmq.jobQueue, { durable: true });
    await channel.assertQueue(config.rabbitmq.resultQueue, { durable: true });

    // Prefetch limits the worker to processing 1 job at a time to prevent memory exhaustion
    channel.prefetch(1);

    console.log('Worker is listening for zip jobs...');

    channel.consume(config.rabbitmq.jobQueue, async (msg) => {
      if (!msg) return;

      const { room, files, jobId } = JSON.parse(msg.content.toString());
      console.log(`Processing job ${jobId} for room ${room}...`);

      try {
        const zipFileName = await processZipJob(files, jobId);
        
        // Notify the backend API that the zip is ready
        const resultPayload = JSON.stringify({ room, jobId, zipFileName });
        channel.sendToQueue(config.rabbitmq.resultQueue, Buffer.from(resultPayload), {
          persistent: true,
        });

        // Acknowledge the message only after complete success
        channel.ack(msg);
        console.log(`Job ${jobId} completed successfully.`);
      } catch (error) {
        console.error(`Job ${jobId} failed:`, error);
        channel.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.error('Worker failed to start', error);
    process.exit(1);
  }
};

bootstrapWorker();