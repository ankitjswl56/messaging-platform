'use client';

import { RenderFilePreview } from "./components/RenderFilePreview";
import { useState, useEffect, useRef, FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9000/chat-payloads'; 
const ROOM_ID = 'general-chat';

export interface Message {
  id: string;
  sender: 'me' | 'other' | 'system';
  type: 'text' | 'file';
  content: string; 
  downloadUrl?: string;
  status?: 'uploading' | 'ready';
  progress?: number;
}

interface ChatHistoryMessage {
  id: string;
  room: string;
  message: string;
  senderId: string;
  fileUrl?: string;
  timestamp: number;
}

export default function ChatPage() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socketInstance = io(API_URL);
    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      socketInstance.emit('join_room', ROOM_ID);
    });

    socketInstance.on('message_history', (history: ChatHistoryMessage[]) => {
      const formattedHistory: Message[] = history.map((msg) => ({
        id: msg.id,
        sender: msg.senderId === socketInstance.id ? 'me' : 'other',
        type: msg.fileUrl ? 'file' : 'text',
        content: msg.message,
        downloadUrl: msg.fileUrl,
        status: 'ready'
      }));

      setMessages([
        { id: 'sys-1', sender: 'system', type: 'text', content: 'Connected to secure room.' },
        ...formattedHistory
      ]);
    });

    socketInstance.on('receive_message', (data: { room: string; message: string; senderId: string; fileUrl?: string }) => {
      if (data.senderId === socketInstance.id) return;
      
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        sender: 'other', 
        type: data.fileUrl ? 'file' : 'text', 
        content: data.message,
        downloadUrl: data.fileUrl,
        status: 'ready'
      }]);
    });

    socketInstance.on('disconnect', () => setIsConnected(false));

    // Cleanups
    return () => { 
      socketInstance.disconnect(); 
      socketRef.current = null;
    };
  }, []);

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    const socket = socketRef.current;
    if (!inputText.trim() || !socket) return;

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'me', type: 'text', content: inputText }]);
    socket.emit('send_message', { room: ROOM_ID, message: inputText, senderId: socket.id });
    setInputText('');
  };

  const uploadFileWithProgress = (file: File, url: string, messageId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setMessages((prev) => prev.map(msg => 
            msg.id === messageId ? { ...msg, progress: percentComplete } : msg
          ));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setMessages((prev) => prev.map(msg => 
            msg.id === messageId ? { ...msg, status: 'ready', progress: 100 } : msg
          ));
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network Error during upload'));
      xhr.send(file);
    });
  };

  const handleFileUpload = async (files: FileList | null) => {
    const socket = socketRef.current;
    if (!files || files.length === 0 || !socket) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const messageId = `upload-${Date.now()}-${i}`;

      const localPreviewUrl = URL.createObjectURL(file);

      setMessages((prev) => [...prev, { 
        id: messageId, 
        sender: 'me', 
        type: 'file', 
        content: file.name, 
        downloadUrl: localPreviewUrl,
        status: 'uploading',
        progress: 0
      }]);

      try {
        const urlRes = await fetch(`${API_URL}/api/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name }),
        });
        
        if (!urlRes.ok) throw new Error('Failed to fetch pre-signed URL');
        const { url } = await urlRes.json();

        await uploadFileWithProgress(file, url, messageId);

        const publicFileUrl = `${MINIO_URL}/${encodeURIComponent(file.name)}`;

        socket.emit('send_message', { 
          room: ROOM_ID, 
          message: file.name, 
          senderId: socket.id,
          fileUrl: publicFileUrl 
        });

      } catch (error) {
        console.error('File upload sequence failed:', error);
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <main className="flex flex-col h-screen bg-primary-black text-primary-white">
      <header className="px-6 py-4 border-b border-surface-black flex justify-between z-10">
        <h1 className="text-xl font-bold tracking-wider">SECURE<span className="text-primary-yellow">SYNC</span></h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-primary-yellow animate-pulse'}`} />
          <span className="text-sm text-gray-400">{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-6 relative" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {isDragging && (
          <div className="absolute inset-0 bg-primary-yellow/10 border-2 border-dashed border-primary-yellow flex items-center justify-center z-20 m-4 rounded-xl">
            <p className="text-2xl font-bold text-primary-yellow animate-bounce">Drop files here</p>
          </div>
        )}

        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                msg.sender === 'me' ? 'bg-primary-yellow text-primary-black rounded-tr-sm' : 
                msg.sender === 'system' ? 'bg-surface-black text-gray-400 text-xs tracking-widest rounded-full' : 
                'bg-surface-black text-primary-white border border-gray-800 rounded-tl-sm'
              }`}>
                <RenderFilePreview msg={msg} />
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </section>

      <footer className="p-6 bg-surface-black">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type or drop files..."
              className="w-full bg-primary-black text-primary-white border border-gray-800 rounded-lg pl-4 pr-12 py-4 focus:outline-none focus:border-primary-yellow"
            />
            <label className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-primary-yellow">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
            </label>
          </div>
          <button type="submit" disabled={!inputText.trim()} className="bg-primary-yellow text-primary-black px-8 font-bold rounded-lg hover:bg-yellow-300 disabled:opacity-50 uppercase">
            Send
          </button>
        </form>
      </footer>
    </main>
  );
}