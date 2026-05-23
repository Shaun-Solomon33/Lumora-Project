import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield, Flame, Droplets, Activity, HeartPulse, Box, AlertTriangle, CheckCircle, Phone, MapPin, Clock, X, MessageSquare } from 'lucide-react';
import EmergencyChat from './EmergencyChat';

interface SOSAlert {
  id: string;
  type: string;
  name: string;
  phone: string;
  location: string;
  description: string;
  status: string;
  timestamp: any;
  assigned_volunteer?: string;
}

const getEmergencyIcon = (type: string) => {
  switch (type) {
    case 'fire': return <Flame className="text-[#ff3b3b]" size={20} />;
    case 'flood': return <Droplets className="text-[#00d4ff]" size={20} />;
    case 'earthquake': return <Activity className="text-[#ff9800]" size={20} />;
    case 'medical': return <HeartPulse className="text-[#4ade80]" size={20} />;
    case 'trapped': return <Box className="text-[#ffeb3b]" size={20} />;
    default: return <AlertTriangle className="text-white/50" size={20} />;
  }
};

const getEmergencyColor = (type: string) => {
  switch (type) {
    case 'fire': return '#ff3b3b';
    case 'flood': return '#00d4ff';
    case 'earthquake': return '#ff9800';
    case 'medical': return '#4ade80';
    case 'trapped': return '#ffeb3b';
    default: return '#ffffff';
  }
};

const formatTimeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs === 1) return '1 hr ago';
  return `${diffHrs} hrs ago`;
};

const addressCache = new Map<string, string>();

const LocationDisplay = ({ location }: { location: string }) => {
  const [address, setAddress] = useState<string>(location);
  const [loading, setLoading] = useState(!addressCache.has(location));

  useEffect(() => {
    if (addressCache.has(location)) {
      setAddress(addressCache.get(location)!);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchAddress = async () => {
      try {
        const parts = location.split(',');
        if (parts.length === 2) {
          const lat = parseFloat(parts[0].trim());
          const lon = parseFloat(parts[1].trim());
          if (!isNaN(lat) && !isNaN(lon)) {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`);
            const data = await response.json();
            if (isMounted && data) {
              let shortAddress = location;
              if (data.address) {
                const a = data.address;
                const local = a.neighbourhood || a.suburb || a.city_district || a.residential || a.commercial;
                const city = a.city || a.town || a.village || a.county;
                if (local && city) shortAddress = `${local}, ${city}`;
                else if (local) shortAddress = local;
                else if (city) shortAddress = city;
                else shortAddress = data.display_name;
              } else if (data.display_name) {
                shortAddress = data.display_name;
              }
              
              addressCache.set(location, shortAddress);
              setAddress(shortAddress);
            }
          }
        }
      } catch (e) {
        console.error("Reverse geocoding failed", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAddress();
    return () => { isMounted = false; };
  }, [location]);

  return (
    <span className="line-clamp-1">
      {loading ? (
        <span className="animate-pulse text-white/50">Resolving location...</span>
      ) : (
        address
      )}
    </span>
  );
};

export default function VolunteerScreen() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [alerts, setAlerts] = useState<SOSAlert[]>([]);
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [acceptedMission, setAcceptedMission] = useState<SOSAlert | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [flashScreen, setFlashScreen] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const prevAlertsCount = useRef(0);
  const prevChatCounts = useRef<Record<string, number>>({});

  // Update time every minute for "time ago"
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(1108.73, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  useEffect(() => {
    if (!isAvailable) {
      setAlerts([]);
      return;
    }

    try {
      // Listen to both pending and accepted so we can keep our accepted ones in the feed
      const q = query(collection(db, 'sos_alerts'), where('status', 'in', ['pending', 'accepted']));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newAlerts: SOSAlert[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as SOSAlert;
          newAlerts.push({ id: doc.id, ...data });
        });
        
        // Sort by timestamp descending
        newAlerts.sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return timeB - timeA;
        });

        setAlerts(newAlerts);

        // Check for new pending alerts
        const pendingCount = newAlerts.filter(a => a.status === 'pending').length;
        if (pendingCount > prevAlertsCount.current) {
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          playAlertSound();
          
          setFlashScreen(true);
          setTimeout(() => setFlashScreen(false), 1000);
        }
        
        prevAlertsCount.current = pendingCount;
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Error setting up snapshot listener:", e);
    }
  }, [isAvailable]);

  useEffect(() => {
    if (acceptedIds.size === 0) return;

    const unsubscribes: (() => void)[] = [];

    acceptedIds.forEach(sosId => {
      const chatRef = doc(db, 'chats', sosId);
      const unsub = onSnapshot(chatRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const messages = data.messages || [];
          const victimMessages = messages.filter((m: any) => m.sender === 'victim').length;
          
          setUnreadCounts(prev => {
            const currentCount = prev[sosId] || 0;
            const prevVictimCount = prevChatCounts.current[sosId] || 0;
            
            // If there are new victim messages and we're not currently chatting with them
            if (victimMessages > prevVictimCount) {
              if (!(showChat && acceptedMission?.id === sosId)) {
                if (navigator.vibrate) navigator.vibrate(100);
                playAlertSound();
                return { ...prev, [sosId]: currentCount + (victimMessages - prevVictimCount) };
              }
            }
            return prev;
          });
          
          prevChatCounts.current[sosId] = victimMessages;
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [acceptedIds, showChat, acceptedMission]);

  const handleAccept = async (alertData: SOSAlert) => {
    try {
      setAcceptedIds(prev => new Set(prev).add(alertData.id));
      const alertRef = doc(db, 'sos_alerts', alertData.id);
      await updateDoc(alertRef, {
        status: 'accepted',
        assigned_volunteer: 'Volunteer On Duty'
      });
      setAcceptedMission(alertData);
    } catch (e) {
      console.error("Error accepting mission:", e);
      alert("Failed to accept mission. Please try again.");
    }
  };

  const handleDecline = (id: string) => {
    setDeclinedIds(prev => new Set(prev).add(id));
  };

  const handleMissionComplete = async () => {
    if (!acceptedMission) return;
    try {
      const alertRef = doc(db, 'sos_alerts', acceptedMission.id);
      await updateDoc(alertRef, {
        status: 'resolved'
      });
      setAcceptedMission(null);
      // Remove from acceptedIds so it disappears from feed
      setAcceptedIds(prev => {
        const next = new Set(prev);
        next.delete(acceptedMission.id);
        return next;
      });
    } catch (e) {
      console.error("Error completing mission:", e);
      alert("Failed to complete mission. Please try again.");
    }
  };

  const visibleAlerts = alerts.filter(a => 
    !declinedIds.has(a.id) && 
    (a.status === 'pending' || (a.status === 'accepted' && acceptedIds.has(a.id)))
  );

  return (
    <main className={`flex-1 w-full flex flex-col bg-[#0a0f1e] animate-in fade-in duration-500 relative transition-colors ${flashScreen ? 'border-4 border-[#ff3b3b]' : ''}`}>
      
      {/* Header */}
      <header className="bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/10 z-40 shrink-0 p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-widest text-white">VOLUNTEER PANEL</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] opacity-80">Emergency Response Network</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 uppercase tracking-widest">Mark Yourself Available</span>
            <button 
              onClick={() => setIsAvailable(!isAvailable)}
              className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isAvailable ? 'bg-[#4ade80]' : 'bg-white/20'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${isAvailable ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </div>

        {isAvailable ? (
          <div className="flex items-center gap-2 bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] px-3 py-2 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse shadow-[0_0_8px_#4ade80]"></div>
            <span className="text-xs font-bold tracking-widest uppercase">YOU ARE ACTIVE — STANDING BY</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/50 px-3 py-2 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-white/30"></div>
            <span className="text-xs font-bold tracking-widest uppercase">YOU ARE OFFLINE</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!isAvailable ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <Shield size={64} className="text-white/20 mb-4" />
            <h2 className="text-lg font-bold tracking-widest text-white mb-2 uppercase">Offline Mode</h2>
            <p className="text-xs text-white/60">Toggle availability to start receiving emergency alerts.</p>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-[#4ade80] rounded-full blur-xl opacity-20 animate-pulse"></div>
              <Shield size={80} className="text-[#4ade80] relative z-10" />
            </div>
            <h2 className="text-2xl font-bold tracking-widest text-white mb-2 uppercase">All Clear</h2>
            <p className="text-sm text-white/60 uppercase tracking-widest">No active emergencies right now</p>
          </div>
        ) : (
          visibleAlerts.map(alert => {
            const isAccepted = alert.status === 'accepted';
            return (
            <div key={alert.id} className={`bg-white/5 backdrop-blur-md border ${isAccepted ? 'border-[#4ade80]' : 'border-white/10'} rounded-2xl p-4 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden group`}>
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: isAccepted ? '#4ade80' : getEmergencyColor(alert.type) }}></div>
              
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/5 rounded-xl">
                    {isAccepted ? <CheckCircle className="text-[#4ade80]" size={20} /> : getEmergencyIcon(alert.type)}
                  </div>
                  <div>
                    <div className="text-[#00d4ff] font-mono text-xs font-bold tracking-widest">{alert.id.substring(0, 8).toUpperCase()}</div>
                    <div className="text-white font-bold text-sm">{alert.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-white/50 text-xs font-mono">
                  <Clock size={12} />
                  {formatTimeAgo(alert.timestamp)}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-sm text-white/80">
                  <MapPin size={16} className="text-[#00d4ff] shrink-0 mt-0.5" />
                  <LocationDisplay location={alert.location} />
                </div>
                <div className="text-xs text-white/60 line-clamp-2 pl-6">
                  {alert.description}
                </div>
              </div>

              {!isAccepted ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAccept(alert)}
                    className="flex-1 bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30 py-2 rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-[#4ade80]/30 transition-colors"
                  >
                    Accept Mission
                  </button>
                  <button 
                    onClick={() => handleDecline(alert.id)}
                    className="px-4 bg-white/5 text-white/50 border border-white/10 py-2 rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-white/10 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setAcceptedMission(alert)}
                  className="w-full bg-[#4ade80]/10 text-[#4ade80] border border-[#4ade80]/20 py-2 rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-[#4ade80]/20 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={14} /> View Mission Details
                </button>
              )}
            </div>
          )})
        )}
      </div>

      {/* Mission Details Modal */}
      {acceptedMission && (
        <div className="absolute inset-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#050810] border border-[#4ade80]/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_30px_rgba(74,222,128,0.1)] max-h-full flex flex-col">
            <div className="bg-[#4ade80]/20 p-4 flex justify-between items-center border-b border-[#4ade80]/30 shrink-0">
              <div className="flex items-center gap-2 text-[#4ade80]">
                <CheckCircle size={20} />
                <span className="font-bold tracking-widest uppercase text-sm">Mission Accepted</span>
              </div>
              <button onClick={() => setAcceptedMission(null)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/5 rounded-xl">
                  {getEmergencyIcon(acceptedMission.type)}
                </div>
                <div>
                  <div className="text-[#00d4ff] font-mono text-xs font-bold tracking-widest">{acceptedMission.id.toUpperCase()}</div>
                  <div className="text-white font-bold text-lg">{acceptedMission.name}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Emergency Type</div>
                  <div className="text-sm text-white capitalize">{acceptedMission.type}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Location</div>
                  <div className="text-sm text-white flex items-start gap-2">
                    <MapPin size={16} className="text-[#00d4ff] shrink-0 mt-0.5" />
                    <LocationDisplay location={acceptedMission.location} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Description</div>
                  <div className="text-sm text-white/80 bg-white/5 p-3 rounded-xl border border-white/10">
                    {acceptedMission.description}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Time Reported</div>
                  <div className="text-sm text-white font-mono">
                    {acceptedMission.timestamp?.toDate ? acceptedMission.timestamp.toDate().toLocaleString() : new Date(acceptedMission.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => {
                    setUnreadCounts(prev => ({ ...prev, [acceptedMission.id]: 0 }));
                    setShowChat(true);
                  }}
                  className="w-full bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 py-3 rounded-xl flex items-center justify-center gap-2 font-bold tracking-widest text-xs hover:bg-[#00d4ff]/20 transition-colors relative"
                >
                  <MessageSquare size={16} /> CHAT WITH VICTIM
                  {unreadCounts[acceptedMission.id] > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#ff3b3b] text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                      {unreadCounts[acceptedMission.id]}
                    </span>
                  )}
                </button>
                <a 
                  href="tel:112"
                  className="w-full bg-[#ff3b3b] text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold tracking-widest text-xs hover:bg-[#ff3b3b]/90 transition-colors shadow-[0_0_15px_rgba(255,59,59,0.3)]"
                >
                  <Phone size={16} /> CALL VICTIM (112)
                </a>
                <button 
                  onClick={handleMissionComplete}
                  className="w-full bg-[#4ade80]/20 text-[#4ade80] border border-[#4ade80]/30 py-3 rounded-xl flex items-center justify-center gap-2 font-bold tracking-widest text-xs hover:bg-[#4ade80]/30 transition-colors"
                >
                  <CheckCircle size={16} /> MISSION COMPLETE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChat && acceptedMission && (
        <EmergencyChat
          sosId={acceptedMission.id}
          currentUserRole="volunteer"
          currentUserName="Volunteer"
          victimName={acceptedMission.name}
          onClose={() => setShowChat(false)}
        />
      )}
    </main>
  );
}
