import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env';

const s3Client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

export const generatePresignedUploadUrl = async (fileName: string): Promise<string> => {
  const command = new PutObjectCommand({ 
    Bucket: config.minio.bucketName, 
    Key: fileName 
  });
  return getSignedUrl(s3Client, command, { expiresIn: 15 * 60 });
};

export const generatePresignedDownloadUrl = async (fileName: string): Promise<string> => {
  const command = new GetObjectCommand({ 
    Bucket: config.minio.bucketName, 
    Key: fileName 
  });
  return getSignedUrl(s3Client, command, { expiresIn: 60 * 60 });
};