import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Send, ArrowLeft, ShieldAlert } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'victim' | 'volunteer';
  text: string;
  timestamp: number;
  senderName: string;
}

interface EmergencyChatProps {
  sosId: string;
  currentUserRole: 'victim' | 'volunteer';
  currentUserName: string;
  onClose: () => void;
  victimName?: string;
}

export default function EmergencyChat({ sosId, currentUserRole, currentUserName, onClose, victimName }: EmergencyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCount = useRef(0);

  const playMessageSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    console.log("Chat document ID:", sosId);
    const chatRef = doc(db, 'chats', sosId);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedMessages: ChatMessage[] = data.messages || [];
        setMessages(loadedMessages);

        if (loadedMessages.length > prevMessagesCount.current) {
          const lastMessage = loadedMessages[loadedMessages.length - 1];
          if (lastMessage.sender !== currentUserRole) {
            if (navigator.vibrate) navigator.vibrate(100);
            playMessageSound();
          }
        }
        prevMessagesCount.current = loadedMessages.length;
      }
    });

    return () => unsubscribe();
  }, [sosId, currentUserRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      sender: currentUserRole,
      text: inputText.trim(),
      timestamp: Date.now(),
      senderName: currentUserName,
    };

    setInputText('');

    try {
      const chatRef = doc(db, 'chats', sosId);
      await setDoc(chatRef, {
        messages: arrayUnion(newMessage)
      }, { merge: true });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please check your connection.");
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0f1e] flex flex-col animate-in slide-in-from-bottom-full duration-300">
      {/* Header */}
      <header className="bg-[#050810] border-b border-white/10 p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-widest text-white uppercase">
                {currentUserRole === 'volunteer' ? `MISSION CHAT: ${victimName}` : 'EMERGENCY CHAT'}
              </h1>
              <div className="flex items-center gap-1 bg-[#4ade80]/10 border border-[#4ade80]/30 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></div>
                <span className="text-[9px] font-bold text-[#4ade80] tracking-widest uppercase">LIVE</span>
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] opacity-80">
              {currentUserRole === 'volunteer' ? `ID: ${sosId.substring(0, 8).toUpperCase()}` : 'Connected to Lumora Response Network'}
            </p>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0f1e]/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <ShieldAlert size={48} className="text-[#00d4ff]/50 mb-4" />
            <p className="text-[#00d4ff] italic text-sm tracking-wide">
              Chat connected. You can now communicate securely with your {currentUserRole === 'victim' ? 'responder' : 'victim'}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === currentUserRole;
            const isVictim = msg.sender === 'victim';
            
            // Victim bubbles: dark red #3d0000, border #ff3b3b
            // Volunteer bubbles: dark blue #001a2e, border #00d4ff
            const bubbleBg = isVictim ? 'bg-[#3d0000]' : 'bg-[#001a2e]';
            const bubbleBorder = isVictim ? 'border-[#ff3b3b]' : 'border-[#00d4ff]';
            const textColor = 'text-white';
            const nameColor = isVictim ? 'text-[#ff3b3b]' : 'text-[#00d4ff]';

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${nameColor}`}>
                  {msg.senderName} {isMe ? '(You)' : ''}
                </span>
                <div 
                  className={`max-w-[75%] p-3 rounded-[20px] border ${bubbleBg} ${bubbleBorder} ${textColor} shadow-lg`}
                  style={{
                    borderBottomRightRadius: isMe ? '4px' : '20px',
                    borderBottomLeftRadius: !isMe ? '4px' : '20px',
                  }}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
                <span className="text-[9px] text-white/40 mt-1 font-mono">{formatTime(msg.timestamp)}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#050810] border-t border-white/10 p-4 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00d4ff]/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-[#00d4ff] text-[#0a0f1e] p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00d4ff]/90 transition-colors flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
