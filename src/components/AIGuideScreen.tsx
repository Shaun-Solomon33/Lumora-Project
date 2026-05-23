import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Phone, Trash2, User, MoreHorizontal } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

const SYSTEM_PROMPT = "You are Lumora Emergency AI, a calm and composed disaster survival assistant for users in India. If the user is just saying hi, greeting you, or saying bye, respond politely and briefly without giving emergency advice, and do not append the emergency sign-off. If the user describes an emergency: A person is in an active emergency situation and needs help RIGHT NOW. Give clear, numbered, actionable survival steps in PLAIN TEXT ONLY. Do NOT use markdown formatting, asterisks (**), bolding, or italics. Be concise, calm, and prioritize life safety above all else. Never panic. Never give vague advice. The emergency number is 112 (do NOT mention 911). Always end every emergency response with: 'Stay calm. Help is on the way.' Tailor all advice to the specific emergency the user describes. Keep responses under 150 words so they are easy to read in panic.";

export default function AIGuideScreen() {
  const aiRef = useRef<any>(null);
  
  const getAI = () => {
    if (!aiRef.current) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    }
    return aiRef.current;
  };

  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'model',
    text: "I am Lumora AI. I am here to help you survive. What is your emergency?"
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Store the chat session instance
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize chat session
    chatSessionRef.current = getAI().chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_PROMPT,
      }
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToProcess: string = input) => {
    if (!textToProcess.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToProcess };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      if (!chatSessionRef.current) {
        chatSessionRef.current = getAI().chats.create({
          model: "gemini-3-flash-preview",
          config: { systemInstruction: SYSTEM_PROMPT }
        });
      }

      const response = await Promise.race([
        chatSessionRef.current.sendMessage({ message: textToProcess }),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error("Request timed out")), 15000)
        )
      ]);
      
      // Strip any stray markdown asterisks just in case the model ignores the prompt
      const cleanText = (response.text || "I'm sorry, I couldn't process that. Please try again.")
        .replace(/\*\*/g, '')
        .replace(/\*/g, '');
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: cleanText
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Connection error. Please try sending your message again. If this is a life-threatening emergency, CALL 112 IMMEDIATELY."
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'model',
      text: "I am Lumora AI. I am here to help you survive. What is your emergency?"
    }]);
    // Reset chat session
    chatSessionRef.current = getAI().chats.create({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: SYSTEM_PROMPT }
    });
  };

  return (
    <main className="flex-1 w-full flex flex-col bg-[#0a0f1e] animate-in fade-in duration-500 relative">
      
      {/* Header */}
      <header className="bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/10 z-40 shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 border border-[#00d4ff]/50 flex items-center justify-center">
              <Bot className="text-[#00d4ff]" size={20} />
            </div>
            <div>
              <h1 className="text-white font-bold tracking-widest text-sm flex items-center gap-2">
                LUMORA AI GUIDE
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-white/50 text-[10px] uppercase tracking-widest">AI Online • Emergency Survival Assistant</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="tel:112"
              className="bg-[#ff3b3b] text-white px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(255,59,59,0.3)] flex items-center gap-1.5 font-bold tracking-widest text-[10px] hover:scale-105 transition-transform"
            >
              <Phone size={12} className="animate-pulse" /> CALL 112
            </a>
            <button 
              onClick={handleClearChat}
              className="p-2 text-white/40 hover:text-[#ff3b3b] hover:bg-[#ff3b3b]/10 rounded-full transition-colors"
              title="Clear Chat"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                msg.role === 'user' 
                  ? 'bg-[#ff3b3b]/20 border-[#ff3b3b]/50 text-[#ff3b3b]' 
                  : 'bg-[#00d4ff]/20 border-[#00d4ff]/50 text-[#00d4ff]'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>

              {/* Bubble */}
              <div className={`p-3.5 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-[#ff3b3b]/10 border border-[#ff3b3b]/30 text-white rounded-br-sm'
                  : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-sm'
              }`}>
                {msg.role === 'model' && (
                  <div className="text-[9px] uppercase tracking-widest text-[#00d4ff] mb-1 font-bold">LUMORA AI</div>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="flex items-end gap-2 max-w-[85%]">
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border bg-[#00d4ff]/20 border-[#00d4ff]/50 text-[#00d4ff]">
                <Bot size={14} />
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 rounded-bl-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-[#00d4ff] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#00d4ff] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#00d4ff] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#0a0f1e]/90 backdrop-blur-xl border-t border-white/10 p-4 z-40 shrink-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your emergency..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/50 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-12 h-12 rounded-full bg-[#00d4ff] text-[#0a0f1e] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00b8e6] transition-colors"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>

    </main>
  );
}
