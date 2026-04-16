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