import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'password123',
    bucketName: 'chat-payloads',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672',
    queueName: 'zip_jobs',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};