'use client'
import { Message } from "../page";
import { useState } from "react";

export const RenderFilePreview = ({ msg }: { msg: Message }) => {
  const [isDownloaded, setIsDownloaded] = useState(msg.sender === 'me');

  if (msg.type === 'text') {
    return <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>;
  }

  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(msg.content);
  const isVideo = /\.(mp4|mov|webm)$/i.test(msg.content);
  const isUploading = msg.status === 'uploading';

  const progressJSX = (
    <div className="relative flex items-center justify-center w-12 h-12 bg-black/80 rounded-full">
       <div className="absolute inset-0 border-2 border-primary-yellow border-t-transparent rounded-full animate-spin"></div>
       <span className="relative text-primary-yellow text-[10px] font-bold z-10">{msg.progress}%</span>
    </div>
  );

  const placeholderJSX = (type: string) => (
    <div className="w-full h-40 bg-primary-black border border-gray-800 rounded-lg flex flex-col items-center justify-center min-w-[200px]">
       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" className="opacity-50 mb-2">
         <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14.5 2 14.5 7.5 20 7.5"/>
       </svg>
       <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{type}</span>
    </div>
  );

  const overlayBackgroundClass = (isUploading || !isDownloaded) 
    ? "absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg" 
    : "absolute inset-0 pointer-events-none";

  const overlayJSX = (
    <div className={overlayBackgroundClass}>
      
      {isUploading && progressJSX}

      {!isDownloaded && !isUploading && (
        <button 
          onClick={() => setIsDownloaded(true)} 
          className="bg-primary-yellow p-3 rounded-full text-black hover:scale-110 transition-transform shadow-lg cursor-pointer pointer-events-auto"
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      )}

      {isDownloaded && !isUploading && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
          <a href={msg.downloadUrl} download target="_blank" rel="noopener noreferrer" className="bg-primary-yellow p-2 rounded-full text-black hover:scale-110 transition-transform shadow-lg cursor-pointer flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </div>
      )}
    </div>
  );

  const groupClass = `relative group mt-1`;

  if (isImage) {
    return (
      <div className={groupClass}>
        {!isDownloaded ? placeholderJSX("Image") : (
          <img src={msg.downloadUrl} alt={msg.content} className="rounded-lg max-h-64 object-cover bg-black block w-full min-w-[150px] min-h-[100px]" />
        )}
        {overlayJSX}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={groupClass}>
        {!isDownloaded ? placeholderJSX("Video") : (
          <video src={msg.downloadUrl} controls={!isUploading} className="rounded-lg max-h-64 bg-black w-full min-w-[150px] min-h-[100px]" />
        )}
        {overlayJSX}
      </div>
    );
  }

  return (
    <div className={`relative group mt-1 w-32 h-32 bg-primary-black rounded-xl border border-gray-800 flex flex-col items-center justify-center overflow-hidden`}>
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={msg.sender === 'me' ? '#000' : '#fbbf24'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14.5 2 14.5 7.5 20 7.5"/>
      </svg>
      <p className="text-[10px] text-center px-2 font-bold truncate w-full" style={{ color: msg.sender === 'me' ? '#000' : '#fff' }}>
        {msg.content.split('/').pop()}
      </p>
      {overlayJSX}
    </div>
  );
};