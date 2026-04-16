import * as amqp from 'amqplib';
import { config } from '../config/env';

let channel: amqp.Channel | null = null;

export const connectRabbitMQ = async (): Promise<void> => {
  if (channel) return;

  const connection = await amqp.connect(config.rabbitmq.url);
  const newChannel = await connection.createChannel();
  
  await newChannel.assertQueue(config.rabbitmq.queueName, { durable: true });
  
  channel = newChannel;
};

export const publishZipJob = async (room: string, files: string[], jobId: string): Promise<void> => {
  if (!channel) {
    throw new Error('RabbitMQ channel is not established');
  }

  const payload = JSON.stringify({ room, files, jobId });
  channel.sendToQueue(config.rabbitmq.queueName, Buffer.from(payload), { persistent: true });
};

export const consumeZipResults = async (onResult: (room: string, zipFileName: string) => void): Promise<void> => {
  if (!channel) throw new Error('RabbitMQ channel is not established');

  channel.consume(config.rabbitmq.resultQueue, (msg) => {
    if (!msg) return;
    if (!channel) throw new Error('RabbitMQ channel is not established');

    try {
      const { room, zipFileName } = JSON.parse(msg.content.toString());
      onResult(room, zipFileName);
      channel.ack(msg);
    } catch (error) {
      console.error('Failed to process zip result', error);
      channel.nack(msg, false, false);
    }
  });
};