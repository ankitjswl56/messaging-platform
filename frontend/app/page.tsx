'use client';

import { RenderFilePreview } from '@/components/RenderFilePreview';
import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ROOM_ID = 'general-chat';

export interface Message {
  id: string;
  sender: 'me' | 'other' | 'system';
  type: 'text' | 'zip_ready';
  content: string;
  downloadUrl?: string;
}

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socketInstance = io(API_URL);

    socketInstance.on('connect', () => {
      socketInstance.emit('join_room', ROOM_ID);
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'system', type: 'text', content: 'Connected to secure room.' }]);
    });

    socketInstance.on('receive_message', (data: { room: string; message: string; senderId: string }) => {
      if (data.senderId === socketInstance.id) return;
      
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'other', type: 'text', content: data.message }]);
    });

    socketInstance.on('zip_ready', (data: { downloadUrl: string; fileName: string }) => {
      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        sender: 'system', 
        type: 'zip_ready', 
        content: `Files compressed and ready: ${data.fileName}`,
        downloadUrl: data.downloadUrl 
      }]);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'me', type: 'text', content: inputText }]);
    
    socket.emit('send_message', { room: ROOM_ID, message: inputText, senderId: socket.id });
    setInputText('');
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const uploadedFileNames: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const urlRes = await fetch(`${API_URL}/api/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name }),
        });
        const { url } = await urlRes.json();

        await fetch(url, {
          method: 'PUT',
          body: file,
        });

        uploadedFileNames.push(file.name);
      }

      await fetch(`${API_URL}/api/request-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: ROOM_ID, files: uploadedFileNames }),
      });

      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        sender: 'system', 
        type: 'text', 
        content: `Uploaded ${files.length} files. Worker is generating the archive...` 
      }]);

    } catch (error) {
      console.error('Upload sequence failed', error);
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: 'system', type: 'text', content: 'File upload failed.' }]);
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, []);

  return (
    <main className="flex flex-col h-screen bg-primary-black text-primary-white">
      <header className="px-6 py-4 border-b border-surface-black bg-primary-black flex items-center justify-between z-10">
        <h1 className="text-xl font-bold tracking-wider">
          SECURE<span className="text-primary-yellow">SYNC</span>
        </h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-primary-yellow animate-pulse'}`} />
          <span className="text-sm text-gray-400">{socket?.connected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </header>

      <section 
        className="flex-1 overflow-y-auto p-6 relative"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary-yellow/10 border-2 border-dashed border-primary-yellow flex items-center justify-center z-20 m-4 rounded-xl">
            <p className="text-2xl font-bold text-primary-yellow animate-bounce">Drop heavy payloads here</p>
          </div>
        )}

        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex w-full ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                  msg.sender === 'me' 
                    ? 'bg-primary-yellow text-primary-black rounded-tr-sm' 
                    : msg.sender === 'system'
                    ? 'bg-surface-black text-gray-400 text-xs tracking-widest uppercase rounded-full px-6 py-2'
                    : 'bg-surface-black text-primary-white border border-gray-800 rounded-tl-sm'
                }`}
              >
                {RenderFilePreview(msg)}
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
              placeholder="Type a message or drag files onto the screen..."
              className="w-full bg-primary-black text-primary-white border border-gray-800 rounded-lg pl-4 pr-12 py-4 focus:outline-none focus:border-primary-yellow transition-colors"
              disabled={isUploading}
            />
            <label className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-primary-yellow transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <input 
                type="file" 
                multiple 
                className="hidden" 
                onChange={(e) => handleFileUpload(e.target.files)}
                disabled={isUploading}
              />
            </label>
          </div>
          <button 
            type="submit" 
            disabled={!inputText.trim() || isUploading}
            className="bg-primary-yellow text-primary-black px-8 font-bold rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-wider"
          >
            {isUploading ? 'Uploading...' : 'Send'}
          </button>
        </form>
      </footer>
    </main>
  );
}