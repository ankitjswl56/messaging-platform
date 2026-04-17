import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { config } from './config/env';
import { generatePresignedDownloadUrl, generatePresignedUploadUrl } from './services/minio';
import { connectRabbitMQ, consumeZipResults, publishZipJob } from './services/rabbitmq';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.post('/api/upload-url', async (req: Request, res: Response) => {
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const url = await generatePresignedUploadUrl(fileName);

    return res.json({ url });
  } catch (error) {
    console.error('Failed to generate upload URL', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/request-zip', async (req: Request, res: Response) => {
  try {
    const { room, files } = req.body;
    if (!room || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const jobId = `job_${Date.now()}`;
    await publishZipJob(room, files, jobId);

    return res.status(202).json({ message: 'Zip job queued', jobId });
  } catch (error) {
    console.error('Failed to queue zip job', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

interface ChatMessage {
  id: string;
  room: string;
  message: string;
  senderId: string;
  fileUrl?: string;
  timestamp: number;
}

const roomHistory: Record<string, ChatMessage[]> = {};
const MAX_HISTORY = 50;

io.on('connection', (socket: Socket) => {
  socket.on('join_room', (room: string) => {
    socket.join(room);

    const history = roomHistory[room] || [];
    socket.emit('message_history', history);
  });

  socket.on('send_message', (data: { room: string; message: string; senderId: string; fileUrl?: string }) => {
    const newMsg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      fileUrl: data.fileUrl,
      timestamp: Date.now(),
    };

    if (!roomHistory[data.room]) {
      roomHistory[data.room] = [];
    }
    roomHistory[data.room].push(newMsg);

    if (roomHistory[data.room].length > MAX_HISTORY) {
      roomHistory[data.room].shift();
    }

    io.to(data.room).emit('receive_message', newMsg);
  });
});

const bootstrap = async () => {
  try {
    await connectRabbitMQ();
    console.log('Connected to RabbitMQ');

    await consumeZipResults(async (room, zipFileName) => {
      console.log(`Zip ready for room ${room}: ${zipFileName}`);
      const downloadUrl = await generatePresignedDownloadUrl(zipFileName);
      
      io.to(room).emit('zip_ready', { downloadUrl, fileName: zipFileName });
    });

    httpServer.listen(config.port, () => {
      console.log(`Backend API running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Bootstrap failed', error);
    process.exit(1);
  }
};

bootstrap();