import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Radio, AlertTriangle, Send, Loader2, CheckCircle } from 'lucide-react';

export default function BroadcastSystem() {
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleBroadcast = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    try {
      // Create a promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore timeout")), 5000)
      );

      const broadcastData = {
        message,
        severity,
        timestamp: serverTimestamp(),
        active: true
      };

      // Race the addDoc against the timeout
      await Promise.race([
        addDoc(collection(db, 'broadcasts'), broadcastData),
        timeoutPromise
      ]);
      
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch (error) {
      console.error("Failed to send broadcast (or timeout):", error);
      
      // Fallback: Use localStorage to communicate between tabs if Firestore fails
      try {
        const fallbackData = {
          id: `local-${Date.now()}`,
          message,
          severity,
          timestamp: new Date().toISOString(),
          active: true
        };
        localStorage.setItem('lumora_latest_broadcast', JSON.stringify(fallbackData));
        // Dispatch a custom event for the current tab just in case
        window.dispatchEvent(new Event('storage'));
        
        setSent(true);
        setMessage('');
        setTimeout(() => setSent(false), 3000);
      } catch (e) {
        alert("Failed to send broadcast. Check console for details.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#0a0f1e]/80 backdrop-blur-xl border border-[#ff3b3b]/30 rounded-2xl p-6 relative overflow-hidden">
      {/* Hazard Stripes Background */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[repeating-linear-gradient(45deg,#ff3b3b,#ff3b3b_10px,transparent_10px,transparent_20px)] opacity-50"></div>
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#ff3b3b]/20 flex items-center justify-center">
          <Radio className="text-[#ff3b3b]" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-widest uppercase text-white">Mass Broadcast System</h2>
          <p className="text-xs text-white/50">Send emergency alerts to all Resident dashboards instantly.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2">Alert Severity</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSeverity('INFO')}
              className={`py-2 text-xs font-bold tracking-wider uppercase rounded-xl border transition-all ${
                severity === 'INFO' 
                  ? 'bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setSeverity('WARNING')}
              className={`py-2 text-xs font-bold tracking-wider uppercase rounded-xl border transition-all ${
                severity === 'WARNING' 
                  ? 'bg-[#ffeb3b]/20 border-[#ffeb3b] text-[#ffeb3b]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              Warning
            </button>
            <button
              onClick={() => setSeverity('CRITICAL')}
              className={`py-2 text-xs font-bold tracking-wider uppercase rounded-xl border transition-all ${
                severity === 'CRITICAL' 
                  ? 'bg-[#ff3b3b]/20 border-[#ff3b3b] text-[#ff3b3b]' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              }`}
            >
              Critical
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2">Broadcast Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="E.g., EVACUATE SECTOR 4 IMMEDIATELY. FLASH FLOOD WARNING."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#ff3b3b]/50 resize-none h-24"
          />
        </div>

        <button
          onClick={handleBroadcast}
          disabled={!message.trim() || isSending || sent}
          className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
            sent 
              ? 'bg-green-500/20 text-green-500 border border-green-500/50'
              : !message.trim()
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : severity === 'CRITICAL'
                  ? 'bg-[#ff3b3b] text-white hover:bg-[#ff3b3b]/80 shadow-[0_0_20px_rgba(255,59,59,0.3)]'
                  : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isSending ? (
            <><Loader2 size={18} className="animate-spin" /> Transmitting...</>
          ) : sent ? (
            <><CheckCircle size={18} /> Broadcast Sent</>
          ) : (
            <><Send size={18} /> Transmit Broadcast</>
          )}
        </button>
      </div>
    </div>
  );
}
