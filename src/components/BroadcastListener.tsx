import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, Info, X, Radio } from 'lucide-react';

interface Broadcast {
  id: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: any;
  active: boolean;
}

export default function BroadcastListener() {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lumora_dismissed_broadcasts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [lastPlayedId, setLastPlayedId] = useState<string | null>(null);

  const playAlertSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      // Create an attention-grabbing two-tone sound
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.2); // C#6
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.error("Audio playback failed:", e);
    }
  };

  useEffect(() => {
    if (broadcast && broadcast.id !== lastPlayedId) {
      playAlertSound();
      setLastPlayedId(broadcast.id);
    }
  }, [broadcast, lastPlayedId]);

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem('lumora_dismissed_broadcasts', JSON.stringify(newDismissed));
    setBroadcast(null);
  };

  useEffect(() => {
    let unsubscribe = () => {};

    try {
      // Listen for the most recent broadcasts (avoiding composite index requirement)
      const q = query(
        collection(db, 'broadcasts'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          // Find the most recent active broadcast
          const activeDoc = snapshot.docs.find(doc => doc.data().active === true);
          
          if (activeDoc) {
            const data = activeDoc.data() as Broadcast;
            data.id = activeDoc.id;
            
            // Only show if it's new (not dismissed) and within the last 24 hours
            const now = new Date();
            let broadcastTime = new Date();
            try {
              if (data.timestamp?.toDate) {
                broadcastTime = data.timestamp.toDate();
              } else if (data.timestamp) {
                broadcastTime = new Date(data.timestamp);
              }
              if (isNaN(broadcastTime.getTime())) {
                broadcastTime = new Date();
              }
            } catch (e) {
              broadcastTime = new Date();
            }
            
            const diffMs = now.getTime() - broadcastTime.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours < 24 && !dismissedIds.includes(data.id)) {
              setBroadcast(data);
            } else {
              setBroadcast(null);
            }
          } else {
            setBroadcast(null);
          }
        } else {
          setBroadcast(null);
        }
      });
    } catch (e) {
      console.error("Error listening to broadcasts:", e);
    }

    // Fallback: Listen to localStorage for local testing or if Firestore fails
    const handleStorage = () => {
      try {
        const localData = localStorage.getItem('lumora_latest_broadcast');
        if (localData) {
          const data = JSON.parse(localData);
          
          const now = new Date();
          let broadcastTime = new Date();
          try {
            if (data.timestamp) {
              broadcastTime = new Date(data.timestamp);
            }
            if (isNaN(broadcastTime.getTime())) {
              broadcastTime = new Date();
            }
          } catch (e) {
            broadcastTime = new Date();
          }
          
          const diffMs = now.getTime() - broadcastTime.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          if (diffHours < 24 && !dismissedIds.includes(data.id)) {
            // Convert string timestamp to a mock Firestore Timestamp object for the UI
            const validTime = isNaN(broadcastTime.getTime()) ? new Date() : broadcastTime;
            data.timestamp = {
              toDate: () => validTime
            };
            setBroadcast(data);
          }
        }
      } catch (e) {
        console.error("Error parsing local broadcast:", e);
      }
    };

    window.addEventListener('storage', handleStorage);
    // Check initially
    handleStorage();

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, [dismissedIds]);

  if (!broadcast) return null;

  const getSeverityStyles = () => {
    switch (broadcast.severity) {
      case 'CRITICAL':
        return 'bg-[#ff3b3b]/90 border-[#ff3b3b] text-white shadow-[0_0_30px_rgba(255,59,59,0.5)]';
      case 'WARNING':
        return 'bg-[#ffeb3b]/90 border-[#ffeb3b] text-black shadow-[0_0_30px_rgba(255,235,59,0.3)]';
      case 'INFO':
        return 'bg-[#00d4ff]/90 border-[#00d4ff] text-white shadow-[0_0_30px_rgba(0,212,255,0.3)]';
      default:
        return 'bg-white/90 border-white text-black';
    }
  };

  const getIcon = () => {
    switch (broadcast.severity) {
      case 'CRITICAL': return <AlertTriangle className="animate-pulse" size={24} />;
      case 'WARNING': return <AlertTriangle size={24} />;
      case 'INFO': return <Info size={24} />;
      default: return <Radio size={24} />;
    }
  };

  const formatTime = (timestamp: any) => {
    try {
      let d = new Date();
      if (timestamp?.toDate) {
        d = timestamp.toDate();
      } else if (timestamp) {
        d = new Date(timestamp);
      }
      
      if (isNaN(d.getTime())) {
        return 'Now';
      }
      
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Now';
    }
  };

  return (
    <div className="fixed top-16 left-0 w-full z-40 px-4 animate-in slide-in-from-top-4 fade-in duration-500">
      <div className={`max-w-md mx-auto rounded-2xl border p-4 backdrop-blur-xl flex items-start gap-4 ${getSeverityStyles()}`}>
        <div className="shrink-0 mt-1">
          {getIcon()}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold tracking-widest uppercase text-xs opacity-80">
              {broadcast.severity === 'CRITICAL' ? 'EMERGENCY BROADCAST' : 'SYSTEM BROADCAST'}
            </h3>
            <span className="text-[10px] opacity-60 font-mono">
              {formatTime(broadcast.timestamp)}
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed">
            {broadcast.message}
          </p>
        </div>
        <button 
          onClick={() => handleDismiss(broadcast.id)}
          className="shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors opacity-70 hover:opacity-100"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
