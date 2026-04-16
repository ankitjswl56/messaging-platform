import * as Minio from 'minio';
import { config } from '../config/env';

const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export const generatePresignedUploadUrl = async (fileName: string): Promise<string> => {
  return minioClient.presignedPutObject(config.minio.bucketName, fileName, 15 * 60);
};

export const generatePresignedDownloadUrl = async (fileName: string): Promise<string> => {
  return minioClient.presignedGetObject(config.minio.bucketName, fileName, 60 * 60);
};