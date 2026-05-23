import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Phone, CheckCircle2, X, Share2, Loader2, Navigation, MessageSquare } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import EmergencyChat from './EmergencyChat';

export default function SOSScreen() {
  const [step, setStep] = useState<'button' | 'form' | 'success'>('button');
  const [loading, setLoading] = useState(false);
  const [sosId, setSosId] = useState('');
  const [activeSosId, setActiveSosId] = useState<string | null>(localStorage.getItem('activeSosId'));
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevVolunteerCount = useRef(0);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    emergency_type: 'Medical Emergency',
    description: ''
  });

  // When activeSosId changes, update localStorage
  useEffect(() => {
    if (activeSosId) {
      localStorage.setItem('activeSosId', activeSosId);
    } else {
      localStorage.removeItem('activeSosId');
    }
  }, [activeSosId]);

  // Listen to chat for unread count
  useEffect(() => {
    if (!activeSosId) return;
    const chatRef = doc(db, 'chats', activeSosId);
    const unsub = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const messages = data.messages || [];
        const volunteerMessages = messages.filter((m: any) => m.sender === 'volunteer').length;
        
        if (volunteerMessages > prevVolunteerCount.current) {
          if (!showChat) {
            setUnreadCount(prev => prev + (volunteerMessages - prevVolunteerCount.current));
            if (navigator.vibrate) navigator.vibrate(100);
          }
        }
        prevVolunteerCount.current = volunteerMessages;
      }
    });
    return () => unsub();
  }, [activeSosId, showChat]);

  const handleOpenChat = () => {
    setUnreadCount(0);
    setShowChat(true);
  };

  const handleCancelAlert = () => {
    setActiveSosId(null);
    setSosId('');
    setStep('button');
  };

  // Pre-fetch location when screen mounts
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            location: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          }));
        },
        (err) => console.warn("Location access denied or unavailable", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleSOSClick = () => {
    // Haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    setStep('form');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported by your browser.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        }));
      },
      (err) => alert("Could not fetch location. Please ensure permissions are granted."),
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Check if Firebase is configured
      if (!isFirebaseConfigured) {
        // Demo Mode: Simulate network delay and success
        console.warn("Firebase is not configured. Simulating SOS alert submission for demo purposes.");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const demoId = `LUM-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        setSosId(demoId);
        setActiveSosId(demoId);
        setStep('success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        return;
      }

      const docRef = await addDoc(collection(db, 'sos_alerts'), {
        ...formData,
        timestamp: serverTimestamp(),
        status: 'pending',
        assigned_volunteer: null
      });
      
      const newSosId = docRef.id;
      setSosId(newSosId);
      setActiveSosId(newSosId);
      setStep('success');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); // Success pattern
    } catch (error: any) {
      console.error("Error adding document: ", error);
      alert(error.message || "Failed to send alert. If you have no internet, please call emergency services directly.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const text = `🚨 EMERGENCY ALERT 🚨\nName: ${formData.name}\nEmergency: ${formData.emergency_type}\nLocation: ${formData.location}\nSOS ID: ${sosId}\nSent via Lumora Emergency Systems`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Emergency Alert',
        text: text
      }).catch(console.error);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  return (
    <main className="w-full p-4 max-w-md mx-auto min-h-[80vh] flex flex-col items-center justify-center relative animate-in fade-in duration-500">
      
      {/* Fixed Call 112 Button */}
      <a 
        href="tel:112"
        className="fixed top-20 right-4 z-50 bg-[#ff3b3b] text-white p-3 rounded-full shadow-[0_0_20px_rgba(255,59,59,0.5)] flex items-center gap-2 font-bold tracking-widest text-xs hover:scale-105 transition-transform"
      >
        <Phone size={16} className="animate-pulse" /> CALL 112
      </a>

      {step === 'button' && (
        <div className="flex flex-col items-center justify-center w-full h-full space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-widest text-white">EMERGENCY SOS</h2>
            <p className="text-white/50 text-sm">Tap the button below to request immediate assistance.</p>
          </div>
          
          <button 
            onClick={handleSOSClick}
            className="relative group w-64 h-64 flex items-center justify-center rounded-full focus:outline-none"
          >
            {/* Ripple Effects */}
            <div className="absolute w-full h-full bg-[#ff3b3b] rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20"></div>
            <div className="absolute w-full h-full bg-[#ff3b3b] rounded-full animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-10 delay-300"></div>
            <div className="absolute w-full h-full bg-[#ff3b3b] rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-5 delay-700"></div>
            
            {/* Main Button */}
            <div className="relative z-10 w-48 h-48 bg-gradient-to-b from-[#ff5252] to-[#d32f2f] rounded-full shadow-[0_0_50px_rgba(255,59,59,0.6),inset_0_4px_10px_rgba(255,255,255,0.3)] flex items-center justify-center group-hover:scale-95 group-active:scale-90 transition-all duration-300 border-4 border-[#ff3b3b]/50">
              <span className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">SOS</span>
            </div>
          </button>
          
          <div className="text-[#ff3b3b] text-xs uppercase tracking-widest font-bold animate-pulse flex items-center gap-2">
            <AlertTriangle size={14} /> For severe emergencies only
          </div>
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold tracking-widest text-white flex items-center gap-2">
              <AlertTriangle className="text-[#ff3b3b]" size={20} /> SOS DETAILS
            </h3>
            <button type="button" onClick={() => setStep('button')} className="text-white/40 hover:text-white p-1">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">Full Name</label>
              <input 
                required
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-[#0a0f1e]/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#ff3b3b]/50 focus:ring-1 focus:ring-[#ff3b3b]/50 transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">Location</label>
              <div className="flex gap-2">
                <input 
                  required
                  type="text" 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="flex-1 bg-[#0a0f1e]/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#ff3b3b]/50 focus:ring-1 focus:ring-[#ff3b3b]/50 transition-all"
                  placeholder="Address or Landmark"
                />
                <button 
                  type="button"
                  onClick={handleGetLocation}
                  className="bg-white/5 border border-white/10 p-3 rounded-xl text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors"
                  title="Use My Location"
                >
                  <Navigation size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">Emergency Type</label>
              <select 
                value={formData.emergency_type}
                onChange={e => setFormData({...formData, emergency_type: e.target.value})}
                className="w-full bg-[#0a0f1e]/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#ff3b3b]/50 focus:ring-1 focus:ring-[#ff3b3b]/50 transition-all appearance-none"
              >
                <option value="Fire">🔥 Fire</option>
                <option value="Flood">🌊 Flood</option>
                <option value="Earthquake">🌋 Earthquake</option>
                <option value="Medical Emergency">⚕️ Medical Emergency</option>
                <option value="Trapped / Stuck">🧱 Trapped / Stuck</option>
                <option value="Other">⚠️ Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">Brief Description (Max 200 chars)</label>
              <textarea 
                required
                maxLength={200}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full bg-[#0a0f1e]/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-[#ff3b3b]/50 focus:ring-1 focus:ring-[#ff3b3b]/50 transition-all resize-none h-24"
                placeholder="E.g., Trapped on the second floor, water rising rapidly..."
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff3b3b] hover:bg-[#ff5252] text-white font-bold tracking-widest uppercase py-4 rounded-xl shadow-[0_0_20px_rgba(255,59,59,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <AlertTriangle size={20} />}
            {loading ? 'TRANSMITTING...' : 'SEND EMERGENCY ALERT'}
          </button>
        </form>
      )}

      {step === 'success' && (
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center relative">
              <div className="absolute w-full h-full border-4 border-green-500/30 rounded-full animate-[ping_2s_ease-out_infinite]"></div>
              <CheckCircle2 size={48} className="text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-2">ALERT TRANSMITTED</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Your SOS has been received.<br/>Help is being dispatched to your location.
            </p>
          </div>

          <div className="bg-[#0a0f1e]/50 border border-white/10 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Official SOS ID</div>
            <div className="text-2xl font-mono font-bold text-[#00d4ff] tracking-widest">
              {sosId.startsWith('LUM-') ? sosId : sosId.substring(0, 8).toUpperCase()}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button 
              onClick={handleOpenChat}
              className="w-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 text-[#00d4ff] font-bold tracking-widest uppercase text-xs py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} /> CHAT WITH RESPONDER
            </button>

            <button 
              onClick={handleShare}
              className="w-full bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 text-[#25D366] font-bold tracking-widest uppercase text-xs py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Share2 size={16} /> Share via WhatsApp
            </button>
            
            <button 
              onClick={handleCancelAlert}
              className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 font-bold tracking-widest uppercase text-xs py-4 rounded-xl transition-all"
            >
              Cancel Alert
            </button>
          </div>
        </div>
      )}

      {activeSosId && step !== 'success' && (
        <button
          onClick={handleOpenChat}
          className="fixed bottom-24 left-4 z-50 bg-[#00d4ff] text-[#0a0f1e] p-3 rounded-full shadow-[0_0_20px_rgba(0,212,255,0.5)] flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-[#ff3b3b] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce border border-[#0a0f1e]">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {showChat && activeSosId && (
        <EmergencyChat
          sosId={activeSosId}
          currentUserRole="victim"
          currentUserName={formData.name || 'Victim'}
          onClose={() => setShowChat(false)}
        />
      )}
    </main>
  );
}
