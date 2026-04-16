import * as Minio from 'minio';
import { Readable } from 'stream';
import { config } from '../config/env';

const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export const getFileStream = async (fileName: string): Promise<Readable> => {
  return minioClient.getObject(config.minio.bucketName, fileName);
};

// Uploads a stream of unknown size using MinIO's multipart upload under the hood
export const uploadStream = async (fileName: string, stream: Readable): Promise<void> => {
  await minioClient.putObject(config.minio.bucketName, fileName, stream);
};