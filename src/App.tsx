import React, { useState, useEffect } from 'react';
import { Activity, Thermometer, Droplets, Wind, MessageSquare, AlertTriangle, LayoutDashboard, BrainCircuit, LifeBuoy, Users, MapPin, Loader2, Search, ChevronDown, ChevronUp, Share2, Radar, Navigation, Bot, ShieldAlert, CloudRainWind, Clock as ClockIcon, LogIn, UserCircle, Shield, Radio } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import SOSScreen from './components/SOSScreen';
import AIGuideScreen from './components/AIGuideScreen';
import VolunteerScreen from './components/VolunteerScreen';
import InteractiveMap from './components/InteractiveMap';
import BroadcastSystem from './components/BroadcastSystem';
import BroadcastListener from './components/BroadcastListener';
import SurvivalVaultScreen from './components/SurvivalVaultScreen';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const CITIES = [
  { name: 'Bengaluru, IN', lat: 12.9716, lon: 77.5946 },
  { name: 'New Delhi, IN', lat: 28.6139, lon: 77.2090 },
  { name: 'Tokyo, JP', lat: 35.6762, lon: 139.6503 },
  { name: 'San Francisco, US', lat: 37.7749, lon: -122.4194 },
  { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
  { name: 'Sydney, AU', lat: -33.8688, lon: 151.2093 },
];

function fetchWithXHR(url: string, headers: Record<string, string> = {}, timeoutMs: number = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.timeout = timeoutMs;
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error(`HTTP Error: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network Error'));
    xhr.ontimeout = () => reject(new Error('Request Timeout'));
    xhr.send();
  });
}

function parseDate(dateInput: any): Date {
  if (!dateInput) return new Date();
  
  // Handle specific formats like "Sun Mar 08 17:30:00 IST 2026"
  let dateStr = String(dateInput);
  if (dateStr.includes(' IST ')) {
    dateStr = dateStr.replace(' IST ', ' +0530 ');
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

function useRealData(lat: number, lon: number) {
  const [data, setData] = useState<{ temp: number | null, humidity: number | null, wind: number | null, seismic: number | null, rain: number | null, pressure: number | null }>({
    temp: null, humidity: null, wind: null, seismic: null, rain: null, pressure: null
  });

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        // Fetch Weather (Weather Union) using proxy
        const weatherApiKey = import.meta.env.VITE_WEATHER_API_KEY;
        let temp = 25, humidity = 60, wind = 15, rain = 0, pressure = 1013;
        
        if (weatherApiKey) {
          try {
            const weatherJson = await fetchWithXHR(`/weather-union-api/gw/weather/external/v0/get_weather_data?latitude=${lat}&longitude=${lon}`, {
              'x-zomato-api-key': weatherApiKey
            }, 2500); // Shorter timeout for Weather Union
            if (weatherJson && weatherJson.locality_weather_data) {
              const wd = weatherJson.locality_weather_data;
              temp = wd.temperature ?? temp;
              humidity = wd.humidity ?? humidity;
              wind = wd.wind_speed ?? wind;
              rain = wd.rain_intensity ?? rain;
              pressure = wd.pressure ?? pressure; // Note: Weather Union might not return pressure, but we'll try
            }
          } catch (e) {
            console.error("Weather Union API failed, falling back to Open-Meteo", e);
            const weatherJson = await fetchWithXHR(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,surface_pressure`);
            temp = weatherJson.current.temperature_2m;
            humidity = weatherJson.current.relative_humidity_2m;
            wind = weatherJson.current.wind_speed_10m;
            rain = weatherJson.current.precipitation ?? 0;
            pressure = weatherJson.current.surface_pressure ?? 1013;
          }
        } else {
          const weatherJson = await fetchWithXHR(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,surface_pressure`);
          temp = weatherJson.current.temperature_2m;
          humidity = weatherJson.current.relative_humidity_2m;
          wind = weatherJson.current.wind_speed_10m;
          rain = weatherJson.current.precipitation ?? 0;
          pressure = weatherJson.current.surface_pressure ?? 1013;
        }
        
        // Fetch Seismic (USGS) - Max magnitude in last 30 days within 1000km
        let maxMag = 0.0;
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const dateStr = thirtyDaysAgo.toISOString().split('T')[0];
          const seismicJson = await fetchWithXHR(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=1000&limit=5&starttime=${dateStr}&orderby=magnitude`);
          
          if (seismicJson.features && seismicJson.features.length > 0) {
            maxMag = seismicJson.features[0].properties.mag;
          }
        } catch (seismicError) {
          console.warn("USGS seismic fetch failed, defaulting to 0", seismicError);
        }

        if (isMounted) {
          setData({
            temp,
            humidity,
            wind,
            rain,
            pressure,
            seismic: Math.max(0, maxMag) // Ensure no negative magnitudes
          });
        }
      } catch (error) {
        console.error("Failed to fetch real data:", error);
        // Fallback to safe defaults if API fails entirely
        if (isMounted) {
           setData({ temp: 25, humidity: 60, wind: 15, rain: 0, pressure: 1013, seismic: 0 });
        }
      }
    };

    setData({ temp: null, humidity: null, wind: null, rain: null, pressure: null, seismic: null }); // Reset on location change
    fetchAll();
    
    const interval = setInterval(fetchAll, 5 * 60 * 1000); // refresh every 5 mins
    return () => { isMounted = false; clearInterval(interval); };
  }, [lat, lon]);

  return data;
}

function useLiveAlerts(lat: number, lon: number, realData: any) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAlerts = async () => {
      if (isMounted) setLoading(true);
      try {
        const newAlerts: Alert[] = [];

        // 1. Generate IMD-style warnings based on REAL weather data
        if (realData.temp !== null) {
          if (realData.temp >= 40) {
            newAlerts.push({
              id: `imd-heat-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Severe Heat Wave Warning',
              severity: 'CRITICAL',
              description: `Severe heat wave conditions observed. Temperature reached ${realData.temp.toFixed(1)}°C. Avoid prolonged sun exposure.`
            });
          } else if (realData.temp >= 35) {
            newAlerts.push({
              id: `imd-heat-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Heat Wave Alert',
              severity: 'HIGH',
              description: `Heat wave conditions observed. Temperature at ${realData.temp.toFixed(1)}°C. Stay hydrated.`
            });
          } else if (realData.temp <= 5) {
            newAlerts.push({
              id: `imd-cold-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Cold Wave Alert',
              severity: 'HIGH',
              description: `Severe cold wave conditions. Temperature dropped to ${realData.temp.toFixed(1)}°C.`
            });
          }
        }

        if (realData.rain !== null) {
          if (realData.rain >= 50) {
            newAlerts.push({
              id: `imd-rain-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Extremely Heavy Rainfall Warning',
              severity: 'CRITICAL',
              description: `Extremely heavy rainfall of ${realData.rain.toFixed(1)} mm/h detected. High risk of flash floods.`
            });
          } else if (realData.rain >= 15) {
            newAlerts.push({
              id: `imd-rain-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Heavy Rainfall Alert',
              severity: 'HIGH',
              description: `Heavy rainfall of ${realData.rain.toFixed(1)} mm/h detected. Waterlogging possible in low-lying areas.`
            });
          } else if (realData.rain >= 5) {
            newAlerts.push({
              id: `imd-rain-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Moderate Rainfall Advisory',
              severity: 'MODERATE',
              description: `Moderate rainfall of ${realData.rain.toFixed(1)} mm/h detected. Drive carefully.`
            });
          }
        }

        if (realData.wind !== null) {
          if (realData.wind >= 60) {
            newAlerts.push({
              id: `imd-wind-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Severe Squall Warning',
              severity: 'CRITICAL',
              description: `Severe squall with wind speed ${realData.wind.toFixed(1)} km/h. Stay indoors.`
            });
          } else if (realData.wind >= 40) {
            newAlerts.push({
              id: `imd-wind-${Date.now()}`,
              timestamp: new Date(),
              type: 'IMD Strong Wind Alert',
              severity: 'HIGH',
              description: `Strong winds detected at ${realData.wind.toFixed(1)} km/h. Secure loose objects.`
            });
          }
        }

        // 1. USGS Earthquakes (Local Only)
        try {
          // Fetch local earthquakes (no starttime to avoid future date issues in simulated environments)
          const localEqRes = await fetchWithXHR(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=1000&limit=5&orderby=time`);
          if (localEqRes.features) {
            localEqRes.features.forEach((feature: any) => {
              const mag = feature.properties.mag;
              let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
              if (mag >= 6) severity = 'CRITICAL';
              else if (mag >= 4.5) severity = 'HIGH';
              else if (mag >= 3) severity = 'MODERATE';

              newAlerts.push({
                id: `local-${feature.id}`,
                timestamp: parseDate(feature.properties.time),
                type: 'Local Seismic Alert',
                severity,
                description: `Magnitude ${mag.toFixed(1)} earthquake detected nearby: ${feature.properties.place}`
              });
            });
          }
        } catch (e) { console.error("USGS fetch failed", e); }

        // 2. India NDMA Sachet Alerts (India Only)
        // Check if location is roughly in India (lat 8-37, lon 68-97)
        const isIndia = lat >= 8 && lat <= 37 && lon >= 68 && lon <= 97;
        
        if (isIndia) {
          try {
            // Using a CORS proxy since sachet.ndma.gov.in might block direct browser requests
            const ndmaRes = await fetchWithXHR(`https://api.codetabs.com/v1/proxy/?quest=https://sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails`, {}, 3000);
            
            let alertsData = ndmaRes;

            if (Array.isArray(alertsData)) {
              alertsData.forEach((alert: any) => {
                // Filter alerts roughly by proximity (very basic distance check)
                const [alertLon, alertLat] = alert.centroid.split(',').map(Number);
                const distance = Math.sqrt(Math.pow(lat - alertLat, 2) + Math.pow(lon - alertLon, 2));
                
                // If within ~500km (roughly 5 degrees) or if it's a major alert
                if (distance < 5 || alert.severity === 'EXTREME') {
                  let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
                  if (alert.severity === 'EXTREME') severity = 'CRITICAL';
                  else if (alert.severity === 'SEVERE') severity = 'HIGH';
                  else if (alert.severity === 'MODERATE' || alert.severity === 'WARNING' || alert.severity === 'ALERT') severity = 'MODERATE';

                  newAlerts.push({
                    id: alert.identifier.toString(),
                    timestamp: parseDate(alert.effective_start_time),
                    type: `NDMA: ${alert.disaster_type}`,
                    severity,
                    description: `${alert.area_description}: ${alert.warning_message}`
                  });
                }
              });
            }
          } catch (e) { console.error("NDMA fetch failed", e); }
        }

        // 3. US NWS Weather Alerts (US Only)
        if (!isIndia) {
          try {
            const nwsRes = await fetchWithXHR(`https://api.weather.gov/alerts/active?point=${lat},${lon}`);
            if (nwsRes.features && nwsRes.features.length > 0) {
              nwsRes.features.forEach((feature: any) => {
                const severityStr = feature.properties.severity;
                let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
                if (severityStr === 'Extreme') severity = 'CRITICAL';
                else if (severityStr === 'Severe') severity = 'HIGH';
                else if (severityStr === 'Moderate') severity = 'MODERATE';

                newAlerts.push({
                  id: feature.properties.id,
                  timestamp: parseDate(feature.properties.effective || feature.properties.sent),
                  type: feature.properties.event || 'Weather Alert',
                  severity,
                  description: feature.properties.headline || 'Severe weather warning in your area.'
                });
              });
            } else {
              // Fallback to general US alerts if local is empty, just to show something
              const generalNwsRes = await fetchWithXHR(`https://api.weather.gov/alerts/active?limit=5`);
              if (generalNwsRes.features) {
                 generalNwsRes.features.forEach((feature: any) => {
                  const severityStr = feature.properties.severity;
                  let severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
                  if (severityStr === 'Extreme') severity = 'CRITICAL';
                  else if (severityStr === 'Severe') severity = 'HIGH';
                  else if (severityStr === 'Moderate') severity = 'MODERATE';

                  newAlerts.push({
                    id: feature.properties.id,
                    timestamp: parseDate(feature.properties.effective || feature.properties.sent),
                    type: `US Weather: ${feature.properties.event}`,
                    severity,
                    description: feature.properties.headline || 'Severe weather warning.'
                  });
                });
              }
            }
          } catch (e) { /* Ignore, likely outside US */ }
        }

        // 3. ReliefWeb Global Disasters (Removed due to CORS/403 issues)

        if (isMounted) {
          // Sort by timestamp descending
          newAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          // Deduplicate by ID just in case
          const uniqueAlerts = Array.from(new Map(newAlerts.map(item => [item.id, item])).values());
          setAlerts(uniqueAlerts.slice(0, 15)); // Keep top 15
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to fetch alerts", e);
        if (isMounted) setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2 * 60 * 1000); // Every 2 minutes
    return () => { isMounted = false; clearInterval(interval); };
  }, [lat, lon]);

  return { alerts, loading };
}

function useLiveData(baseValue: number | null, variance: number, isInteger: boolean = false) {
  const [history, setHistory] = useState<number[]>(Array(10).fill(0));
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (baseValue === null) {
      setIsInitialized(false);
      return;
    }
    
    if (!isInitialized) {
      setHistory(Array(10).fill(baseValue));
      setIsInitialized(true);
    }

    const interval = setInterval(() => {
      setHistory(prev => {
        const lastValue = prev[prev.length - 1];
        // Gentle pull towards the real base value so it doesn't drift too far
        const pull = (baseValue - lastValue) * 0.15; 
        let change = (Math.random() * variance * 2) - variance + pull;
        
        let newValue = lastValue + change;
        if (isInteger) newValue = Math.round(newValue);
        else newValue = Number(newValue.toFixed(1));
        
        return [...prev.slice(1), newValue];
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [baseValue, variance, isInteger, isInitialized]);

  return history;
}

function Sparkline({ data, color }: { data: number[], color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  
  const width = 100;
  const height = 30;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 -5 ${width} ${height + 10}`} className="w-full h-8 overflow-visible opacity-50 group-hover:opacity-100 transition-opacity duration-500">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="transition-all duration-300 ease-linear"
      />
    </svg>
  );
}

function Clock() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <div className="text-sm font-mono text-white/90 tracking-wider">
        {time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
        {time.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
      </div>
    </div>
  );
}

function DataCard({ title, value, unit, icon: Icon, data, color, isLoading, className = "" }: { title: string, value: number, unit: string, icon: any, data: number[], color: string, isLoading?: boolean, className?: string }) {
  const getStatus = () => {
    if (isLoading) return null;
    
    let status = { text: '✅ NOMINAL', color: 'text-green-400 bg-green-400/10 border-green-400/20' };
    
    if (title === 'Heat Risk') {
      if (value > 40) status = { text: '🔴 CRITICAL', color: 'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/20' };
      else if (value > 35) status = { text: '⚠️ ELEVATED', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
    } else if (title === 'Wind Threat') {
      if (value > 60) status = { text: '🔴 CRITICAL', color: 'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/20' };
      else if (value > 40) status = { text: '⚠️ ELEVATED', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
    } else if (title === 'Flood Indicator') {
      if (value > 50) status = { text: '🔴 CRITICAL', color: 'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/20' };
      else if (value > 20) status = { text: '⚠️ ELEVATED', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
    } else if (title === 'Moisture Index') {
      if (value > 90) status = { text: '🔴 CRITICAL', color: 'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/20' };
      else if (value > 75) status = { text: '⚠️ ELEVATED', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
      else if (value < 20) status = { text: '⚠️ DRY', color: 'text-[#ff9800] bg-[#ff9800]/10 border-[#ff9800]/20' };
    } else if (title === 'Seismic') {
      if (value > 5.5) status = { text: '🔴 CRITICAL', color: 'text-[#ff3b3b] bg-[#ff3b3b]/10 border-[#ff3b3b]/20' };
      else if (value > 4.0) status = { text: '⚠️ ELEVATED', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
    } else if (title === 'Atmo Pressure') {
      if (value < 990) status = { text: '⚠️ LOW', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
      else if (value > 1030) status = { text: '⚠️ HIGH', color: 'text-[#ffeb3b] bg-[#ffeb3b]/10 border-[#ffeb3b]/20' };
    }

    return (
      <div className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider border ${status.color}`}>
        {status.text}
      </div>
    );
  };

  return (
    <div className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:bg-white/10 transition-colors duration-300 ${className}`}>
      <div 
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"
        style={{ backgroundColor: color }}
      ></div>
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="p-2 bg-white/5 rounded-xl border border-white/5">
          <Icon size={18} color={color} className="opacity-90 drop-shadow-md" />
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-2xl font-mono font-light text-white flex items-baseline justify-end gap-1 tracking-tight">
            {isLoading ? (
              <span className="animate-pulse text-white/30">--.-</span>
            ) : (
              value
            )}
            {unit && <span className="text-xs text-white/40 font-sans tracking-normal">{unit}</span>}
          </div>
          {getStatus()}
        </div>
      </div>
      <div className="mt-auto relative z-10">
        <h3 className="text-[9px] uppercase tracking-widest text-white/50 mb-3">{title}</h3>
        <Sparkline data={isLoading ? Array(10).fill(0) : data} color={isLoading ? '#ffffff33' : color} />
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, alert = false, badge, offlineBadge = false, onClick }: { icon: any, label: string, active?: boolean, alert?: boolean, badge?: number, offlineBadge?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 p-2 group w-16">
      <div className="relative">
        <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-[#00d4ff]/15 text-[#00d4ff]' : 'text-white/40 group-hover:text-white/80 group-hover:bg-white/5'}`}>
          <Icon size={22} className={active ? 'drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]' : ''} />
        </div>
        {alert && !badge && !offlineBadge && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ff3b3b] rounded-full animate-pulse shadow-[0_0_8px_#ff3b3b] border-2 border-[#0a0f1e]"></span>
        )}
        {badge !== undefined && badge > 0 && !offlineBadge && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#ff3b3b] text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-[0_0_8px_#ff3b3b] border-2 border-[#0a0f1e]">
            {badge}
          </span>
        )}
        {offlineBadge && (
          <span className="absolute -top-1.5 -right-8 px-1 py-0.5 bg-[#4ade80] text-[#0a0f1e] text-[6px] font-bold rounded uppercase tracking-widest shadow-[0_0_4px_#4ade80] border border-[#0a0f1e] whitespace-nowrap">
            WORKS OFFLINE
          </span>
        )}
      </div>
      <span className={`text-[9px] uppercase tracking-wider transition-colors duration-300 ${active ? 'text-[#00d4ff] font-medium' : 'text-white/40 group-hover:text-white/80'}`}>
        {label}
      </span>
    </button>
  );
}

const getSeverityColor = (severity: string) => {
  switch(severity?.toUpperCase()) {
    case 'CRITICAL': return 'bg-[#ff3b3b]';
    case 'HIGH': return 'bg-[#ff9800]';
    case 'MODERATE': return 'bg-[#ffeb3b]';
    case 'LOW': return 'bg-[#00d4ff]';
    default: return 'bg-white/50';
  }
}
const getSeverityColorHex = (severity: string) => {
  switch(severity?.toUpperCase()) {
    case 'CRITICAL': return '#ff3b3b';
    case 'HIGH': return '#ff9800';
    case 'MODERATE': return '#ffeb3b';
    case 'LOW': return '#00d4ff';
    default: return '#ffffff';
  }
}
const getSeverityTextColor = (severity: string) => {
  switch(severity?.toUpperCase()) {
    case 'CRITICAL': return 'text-[#ff3b3b]';
    case 'HIGH': return 'text-[#ff9800]';
    case 'MODERATE': return 'text-[#ffeb3b]';
    case 'LOW': return 'text-[#00d4ff]';
    default: return 'text-white/50';
  }
}

function PredictScreen() {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleAnalyze = async () => {
    if (!city.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are Lumora AI, an advanced disaster and city operations prediction system. Analyze the CURRENT real-world conditions for ${city} using the latest available data and provide a highly realistic 48-hour forecast. 
        CRITICAL INSTRUCTIONS:
        1. DO NOT invent threats. If the city is currently safe and weather is normal, the overallRiskScore should be very low (e.g., 5-15%) and severity LOW.
        2. Include a detailed analysis of current and predicted traffic conditions, highlighting any major gridlocks, road closures, or transit issues.
        3. Consider actual current weather, recent seismic activity, and local news.
        4. For each threat, provide: threat type, confidence score (0-100), severity (LOW/MODERATE/HIGH/CRITICAL), peak time in next 48 hours, and detailed reasoning. Only list threats with a realistic chance of occurring.
        5. Provide an overall city risk score out of 100.
        6. For the fullAnalysis, provide 3-4 concise, punchy bullet points summarizing the situation.
        7. For recommendations, provide 3-4 catchy, attractive, and highly actionable bullet points using relevant emojis and symbols (e.g., 🚦, 🛑, 💧, ⚡).
        Format your response as structured JSON.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallRiskScore: { type: Type.NUMBER },
              overallRiskLevel: { type: Type.STRING },
              trafficConditions: { type: Type.STRING },
              timeline: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    hour: { type: Type.NUMBER },
                    threatType: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    description: { type: Type.STRING }
                  }
                }
              },
              threats: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    threatType: { type: Type.STRING },
                    confidenceScore: { type: Type.NUMBER },
                    severity: { type: Type.STRING },
                    peakTime: { type: Type.STRING },
                    reasoning: { type: Type.STRING }
                  }
                }
              },
              fullAnalysis: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              recommendations: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["overallRiskScore", "overallRiskLevel", "trafficConditions", "timeline", "threats", "fullAnalysis", "recommendations"]
          }
        }
      });
      
      if (response.text) {
        setResult(JSON.parse(response.text));
      }
    } catch (e) {
      console.error(e);
      alert("Analysis failed. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!result) return;
    const text = `🚨 LUMORA AI FORECAST: ${city.toUpperCase()} 🚨\n\nOverall Risk: ${result.overallRiskLevel} (${result.overallRiskScore}/100)\n\nKey Threats:\n${result.threats.filter((t:any) => t.confidenceScore > 10).map((t:any) => `- ${t.threatType}: ${t.severity} (${t.confidenceScore}% confidence)`).join('\n')}\n\nStay safe!`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Lumora AI Forecast',
        text: text
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      alert("Report copied to clipboard!");
    }
  };

  return (
    <main className="w-full p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00d4ff]/50" size={18} />
          <input 
            type="text" 
            placeholder="Enter city name (e.g. Bangalore, IN)" 
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/50 transition-all"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
        </div>
        <button 
          onClick={handleAnalyze}
          disabled={loading || !city.trim()}
          className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 px-6 rounded-xl font-bold tracking-widest uppercase text-xs hover:bg-[#00d4ff]/20 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Analyze
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            <div className="absolute w-full h-full border border-[#00d4ff]/30 rounded-full"></div>
            <div className="absolute w-3/4 h-3/4 border border-[#00d4ff]/20 rounded-full"></div>
            <div className="absolute w-1/2 h-1/2 border border-[#00d4ff]/10 rounded-full"></div>
            <div className="absolute w-full h-full rounded-full border-t-2 border-[#00d4ff] animate-[spin_2s_linear_infinite]"></div>
            <Radar size={32} className="text-[#00d4ff] animate-pulse" />
          </div>
          <div className="text-[#00d4ff] font-mono text-sm tracking-widest animate-pulse text-center">LUMORA AI IS ANALYZING<br/>THREAT VECTORS...</div>
        </div>
      )}

      {!loading && !result && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative w-32 h-32 flex items-center justify-center mb-8">
            <div className="absolute w-full h-full border border-[#00d4ff]/10 rounded-full"></div>
            <div className="absolute w-3/4 h-3/4 border border-[#00d4ff]/20 rounded-full"></div>
            <div className="absolute w-1/2 h-1/2 border border-[#00d4ff]/30 rounded-full"></div>
            <div className="absolute w-full h-full rounded-full border-t-2 border-[#00d4ff] animate-[spin_4s_linear_infinite] opacity-50"></div>
            <Radar size={40} className="text-[#00d4ff] animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-widest text-white mb-3">THREAT INTELLIGENCE</h2>
          <p className="text-sm text-white/50 max-w-md mb-8 leading-relaxed">
            Enter your city to generate a real-time AI-powered threat assessment for the next 48 hours
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[#00d4ff] text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
              <span>⚡</span> AI Powered
            </div>
            <div className="px-3 py-1.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[#00d4ff] text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
              <span>📡</span> Live Data
            </div>
            <div className="px-3 py-1.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 text-[#00d4ff] text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
              <span>🔒</span> 48hr Forecast
            </div>
          </div>
        </div>
      )}

      {!loading && result && (
        <div className="space-y-6">
          {/* Overall Risk Card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
              <div 
                className="h-full transition-all duration-1000 ease-out" 
                style={{ width: `${result.overallRiskScore}%`, backgroundColor: getSeverityColorHex(result.overallRiskLevel), boxShadow: `0 0 10px ${getSeverityColorHex(result.overallRiskLevel)}` }}
              ></div>
            </div>
            <div className="flex justify-between items-end mb-1">
              <div>
                <h2 className="text-[10px] uppercase tracking-widest text-white/50 mb-1">{city} - AI FORECAST</h2>
                <div className="text-4xl font-light font-mono tracking-tight" style={{ color: getSeverityColorHex(result.overallRiskLevel), textShadow: `0 0 20px ${getSeverityColorHex(result.overallRiskLevel)}40` }}>
                  {result.overallRiskScore}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold tracking-widest px-2 py-1 rounded bg-white/5 border border-white/10" style={{ color: getSeverityColorHex(result.overallRiskLevel) }}>
                  {result.overallRiskLevel}
                </div>
                <div className="text-[9px] text-white/30 mt-2 uppercase tracking-widest">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 48-Hour Timeline */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
              <h3 className="text-xs uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2">
                <Activity size={14} /> 48-Hour Threat Timeline
              </h3>
              <div className="border-l-2 border-white/10 ml-3 space-y-6 relative">
                {result.timeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative pl-6">
                    <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${getSeverityColor(item.severity)} shadow-[0_0_8px_${getSeverityColorHex(item.severity)}]`}></div>
                    <div className="text-[10px] text-white/50 font-mono mb-1">+{item.hour}h</div>
                    <div className={`text-sm font-semibold ${getSeverityTextColor(item.severity)}`}>{item.threatType}</div>
                    <div className="text-xs text-white/70 mt-1">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {/* Traffic Conditions Card */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
                <h3 className="text-xs uppercase tracking-widest text-white/50 mb-3 flex items-center gap-2">
                  <Navigation size={14} /> Traffic & Transit Analysis
                </h3>
                <p className="text-sm text-white/80 leading-relaxed">
                  {result.trafficConditions}
                </p>
              </div>

              {/* Threat Breakdown Cards */}
              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-white/50 mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} /> Threat Breakdown
                </h3>
                {result.threats.length === 0 || result.threats.filter((t:any) => t.confidenceScore > 10).length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                    <p className="text-xs text-white/50 uppercase tracking-widest">No significant threats detected</p>
                  </div>
                ) : (
                  result.threats.filter((t:any) => t.confidenceScore > 10).map((threat: any, idx: number) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1 h-full ${getSeverityColor(threat.severity)}`}></div>
                      <div className="flex justify-between items-start mb-2">
                        <div className={`font-semibold ${getSeverityTextColor(threat.severity)}`}>{threat.threatType}</div>
                        <div className="text-xs font-mono bg-white/5 px-2 py-1 rounded border border-white/10">
                          {threat.confidenceScore}% CONF
                        </div>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{threat.reasoning}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* AI Reasoning Panel */}
          <div className="bg-[#050810] border border-[#00d4ff]/20 rounded-2xl overflow-hidden">
            <button 
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="w-full flex justify-between items-center p-4 bg-[#00d4ff]/5 hover:bg-[#00d4ff]/10 transition-colors"
            >
              <div className="flex items-center gap-2 text-[#00d4ff]">
                <BrainCircuit size={16} />
                <span className="text-xs uppercase tracking-widest font-bold">Lumora AI Analysis</span>
              </div>
              {showAnalysis ? <ChevronUp size={16} className="text-[#00d4ff]" /> : <ChevronDown size={16} className="text-[#00d4ff]" />}
            </button>
            {showAnalysis && (
              <div className="p-5 font-mono text-xs text-[#4ade80] leading-relaxed opacity-80 space-y-4">
                <div>
                  <div className="text-white/50 mb-2">{`> INITIALIZING THREAT ANALYSIS...\n> TARGET: ${city.toUpperCase()}`}</div>
                  <ul className="space-y-2">
                    {result.fullAnalysis.map((point: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[#00d4ff]">{`>>`}</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <div className="text-white/50 mb-2">{`> RECOMMENDATIONS:`}</div>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[#ffeb3b]">{`*`}</span>
                        <span className="text-white/90">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="text-white/30 mt-4">{`> END OF REPORT`}</div>
              </div>
            )}
          </div>

          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white py-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-bold transition-all"
          >
            <Share2 size={16} /> Share Report
          </button>
        </div>
      )}
    </main>
  );
}

interface Alert {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
}

function ThreatGauge({ threatLevel, isLoading, locationName, onLocationChange, onAutoDetect, isAutoDetecting }: any) {
  const radius = 100;
  const stroke = 16;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const arcLength = circumference * 0.75; // 270 degrees
  const strokeDashoffset = isLoading ? arcLength : arcLength - (threatLevel / 100) * arcLength;

  const getGaugeColor = (value: number) => {
    if (value < 50) {
      const ratio = value / 50;
      const r = Math.round(74 + (255 - 74) * ratio);
      const g = Math.round(222 + (235 - 222) * ratio);
      const b = Math.round(128 + (59 - 128) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const ratio = (value - 50) / 50;
      const r = Math.round(255 + (255 - 255) * ratio);
      const g = Math.round(235 + (59 - 235) * ratio);
      const b = Math.round(59 + (59 - 59) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  const color = isLoading ? '#ffffff33' : getGaugeColor(threatLevel);

  let threatStatus = 'LOW';
  if (threatLevel > 75) threatStatus = 'CRITICAL';
  else if (threatLevel > 50) threatStatus = 'HIGH';
  else if (threatLevel > 25) threatStatus = 'MODERATE';

  return (
    <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[320px]">
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        <MapPin size={16} className="text-[#00d4ff]" />
        <select 
          className="bg-transparent text-[#00d4ff] text-xs font-bold uppercase tracking-widest outline-none cursor-pointer appearance-none border-b border-[#00d4ff]/30 pb-0.5"
          value={locationName}
          onChange={onLocationChange}
        >
          <option value="AUTO" className="bg-[#0a0f1e]">📍 AUTO-DETECT LOCATION</option>
          {locationName === "Current Location" && (
            <option value="Current Location" className="bg-[#0a0f1e]">CURRENT LOCATION</option>
          )}
          {CITIES.map(c => <option key={c.name} value={c.name} className="bg-[#0a0f1e]">{c.name.toUpperCase()}</option>)}
        </select>
        {isAutoDetecting && <Loader2 size={14} className="animate-spin text-[#00d4ff]" />}
      </div>

      <div className="relative w-[240px] h-[240px] flex items-center justify-center mt-4">
        {/* Background Arc */}
        <svg height="240" width="240" className="absolute transform rotate-[135deg]">
          <circle
            stroke="rgba(255,255,255,0.05)"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            style={{ strokeLinecap: 'round' }}
            r={normalizedRadius}
            cx="120"
            cy="120"
          />
        </svg>
        
        {/* Foreground Arc */}
        <svg height="240" width="240" className="absolute transform rotate-[135deg]">
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            style={{ 
              strokeDashoffset, 
              strokeLinecap: 'round',
              transition: 'stroke-dashoffset 1.5s ease-out, stroke 1.5s ease-out',
              filter: `drop-shadow(0 0 12px ${color}80)`
            }}
            r={normalizedRadius}
            cx="120"
            cy="120"
          />
        </svg>

        {/* Center Content */}
        <div className="absolute flex flex-col items-center justify-center text-center mt-4">
          <h2 className="text-[10px] uppercase tracking-widest text-white/50 mb-1">City Threat Level</h2>
          <div className="text-6xl font-light font-mono tracking-tighter" style={{ color, textShadow: `0 0 20px ${color}40`, transition: 'color 1.5s ease-out' }}>
            {isLoading ? '--' : Math.round(threatLevel)}<span className="text-3xl text-white/40">%</span>
          </div>
          <div className="mt-2 text-xs font-bold tracking-widest px-3 py-1 rounded-full bg-white/5 border border-white/10" style={{ color, transition: 'color 1.5s ease-out' }}>
            {isLoading ? 'CALCULATING' : threatStatus}
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardScreen() {
  const [location, setLocation] = useState(CITIES[0]);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  
  const realData = useRealData(location.lat, location.lon);

  // Apply micro-fluctuations to real data to keep the dashboard "alive"
  const temp = useLiveData(realData.temp, 0.2);
  const humidity = useLiveData(realData.humidity, 1);
  const wind = useLiveData(realData.wind, 1.5);
  const rain = useLiveData(realData.rain, 0.1);
  const pressure = useLiveData(realData.pressure, 0.5);
  const seismic = useLiveData(realData.seismic, 0.05);

  const [threatLevel, setThreatLevel] = useState(0);

  useEffect(() => {
    if (realData.temp === null) return;
    
    // Calculate base threat from real conditions
    let baseThreat = 15;
    if (realData.temp > 35) baseThreat += (realData.temp - 35) * 2;
    if (realData.temp < 5) baseThreat += (5 - realData.temp) * 2;
    if (realData.wind !== null && realData.wind > 40) baseThreat += (realData.wind - 40);
    if (realData.seismic !== null && realData.seismic > 3.0) baseThreat += (realData.seismic - 3.0) * 15;
    
    baseThreat = Math.min(100, Math.max(0, baseThreat));

    const interval = setInterval(() => {
      setThreatLevel(baseThreat + (Math.random() * 2 - 1));
    }, 3000);
    
    setThreatLevel(baseThreat);
    return () => clearInterval(interval);
  }, [realData]);

  const handleAutoDetect = () => {
    setIsAutoDetecting(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            name: "Current Location",
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          setIsAutoDetecting(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not detect location. Please ensure location permissions are granted.");
          setIsAutoDetecting(false);
          // Revert select to previous value by forcing a re-render
          setLocation(prev => ({...prev})); 
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setIsAutoDetecting(false);
    }
  };

  let threatStatus = 'LOW';
  let threatColor = '#00d4ff'; // electric blue
  if (threatLevel > 75) {
    threatStatus = 'CRITICAL';
    threatColor = '#ff3b3b'; // emergency red
  } else if (threatLevel > 50) {
    threatStatus = 'HIGH';
    threatColor = '#ff9800'; // orange
  } else if (threatLevel > 25) {
    threatStatus = 'MODERATE';
    threatColor = '#ffeb3b'; // yellow
  }

  const { alerts, loading: alertsLoading } = useLiveAlerts(location.lat, location.lon, realData);

  const severityColors = {
    CRITICAL: '#ff3b3b',
    HIGH: '#ff9800',
    MODERATE: '#ffeb3b',
    LOW: '#00d4ff'
  };

  const isLoading = realData.temp === null;

  return (
    <main className="w-full p-4 max-w-7xl mx-auto space-y-6">
      {/* Threat Level Banner */}
      <ThreatGauge 
        threatLevel={threatLevel} 
        isLoading={isLoading} 
        locationName={location.name}
        onLocationChange={(e: any) => {
          if (e.target.value === 'AUTO') {
            handleAutoDetect();
          } else {
            const city = CITIES.find(c => c.name === e.target.value);
            if (city) setLocation(city);
          }
        }}
        onAutoDetect={handleAutoDetect}
        isAutoDetecting={isAutoDetecting}
      />

      {/* Data Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DataCard title="Heat Risk" value={temp[9]} unit="°C" icon={Thermometer} data={temp} color="#00d4ff" isLoading={isLoading} />
          <DataCard title="Moisture Index" value={humidity[9]} unit="%" icon={Droplets} data={humidity} color="#00d4ff" isLoading={isLoading} />
          <DataCard title="Wind Threat" value={wind[9]} unit="km/h" icon={Wind} data={wind} color="#00d4ff" isLoading={isLoading} />
          <DataCard title="Flood Indicator" value={rain[9]} unit="mm/h" icon={CloudRainWind} data={rain} color={!isLoading && rain[9] > 10 ? '#ff9800' : '#00d4ff'} isLoading={isLoading} />
          <DataCard title="Atmo Pressure" value={pressure[9]} unit="hPa" icon={Activity} data={pressure} color="#00d4ff" isLoading={isLoading} />
          <DataCard title="Seismic" value={seismic[9]} unit="M" icon={Activity} data={seismic} color={!isLoading && seismic[9] > 4 ? '#ff3b3b' : '#00d4ff'} isLoading={isLoading} />
        </section>

        {/* Real-time Alert Feed */}
        <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={20} className="text-[#00d4ff]" />
              <h3 className="text-sm uppercase tracking-widest font-bold text-white">Live Alert Feed</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3b3b] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff3b3b]"></span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/50">Live Stream</span>
            </div>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {alertsLoading && alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/40">
                <Loader2 size={24} className="animate-spin mb-2 text-[#00d4ff]" />
                <div className="text-xs uppercase tracking-widest">Fetching Global & Local Alerts...</div>
              </div>
            ) : (
              <>
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className="bg-[#0a0f1e]/50 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-white/5 animate-in fade-in slide-in-from-top-4 duration-500"
                    style={{ borderLeft: `3px solid ${severityColors[alert.severity]}` }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span 
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${severityColors[alert.severity]}20`, color: severityColors[alert.severity] }}
                        >
                          {alert.severity}
                        </span>
                        <span className="text-sm font-semibold text-white">{alert.type}</span>
                      </div>
                      <p className="text-xs text-white/60">{alert.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-white/40 text-[10px] font-mono whitespace-nowrap">
                      <ClockIcon size={12} />
                      {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                ))}
                {!alertsLoading && alerts.length === 0 && (
                  <div className="text-center py-8 text-white/40 text-xs uppercase tracking-widest">
                    No active alerts
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
  );
}

export default function App() {
  const [userRole, setUserRole] = useState<'resident' | 'command' | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [pendingAlertsCount, setPendingAlertsCount] = useState(0);
  const [totalAlertsCount, setTotalAlertsCount] = useState(0);

  useEffect(() => {
    try {
      const qPending = query(collection(db, 'sos_alerts'), where('status', '==', 'pending'));
      const unsubscribePending = onSnapshot(qPending, (snapshot) => {
        setPendingAlertsCount(snapshot.size);
      });

      const qAll = query(collection(db, 'sos_alerts'));
      const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
        setTotalAlertsCount(snapshot.size);
      });

      return () => {
        unsubscribePending();
        unsubscribeAll();
      };
    } catch (e) {
      console.error("Firebase not fully configured or error listening to alerts:", e);
    }
  }, []);

  if (!userRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f1e] text-white font-sans p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00d4ff]/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#ff3b3b]/10 rounded-full blur-[100px]"></div>

        <div className="relative z-10 flex flex-col items-center max-w-md w-full">
          <div className="relative flex items-center justify-center w-20 h-20 mb-6">
            <div className="absolute w-full h-full bg-[#00d4ff] rounded-full animate-ping opacity-20"></div>
            <div className="relative w-8 h-8 bg-[#00d4ff] rounded-full shadow-[0_0_20px_#00d4ff]"></div>
          </div>
          
          <h1 className="text-4xl font-bold tracking-widest text-white leading-none mb-2">LUMORA</h1>
          <p className="text-xs uppercase tracking-widest text-[#00d4ff] opacity-80 mb-12 text-center">Next-Gen Emergency Response System</p>

          <div className="w-full space-y-4">
            <button 
              onClick={() => { setUserRole('resident'); setCurrentTab('dashboard'); }}
              className="w-full bg-white/5 border border-white/10 hover:bg-[#00d4ff]/10 hover:border-[#00d4ff]/50 text-white p-6 rounded-2xl flex items-center gap-4 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-[#00d4ff]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserCircle className="text-[#00d4ff]" size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-bold tracking-wider uppercase text-sm mb-1">Resident Portal</h3>
                <p className="text-xs text-white/50">Access live alerts, AI predictions, and SOS tools.</p>
              </div>
            </button>

            <button 
              onClick={() => { setUserRole('command'); setCurrentTab('operations'); }}
              className="w-full bg-white/5 border border-white/10 hover:bg-[#ff3b3b]/10 hover:border-[#ff3b3b]/50 text-white p-6 rounded-2xl flex items-center gap-4 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-[#ff3b3b]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="text-[#ff3b3b]" size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-bold tracking-wider uppercase text-sm mb-1">Command Center</h3>
                <p className="text-xs text-white/50">Manage SOS alerts, dispatch volunteers, and monitor crises.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1e] text-white font-sans selection:bg-[#00d4ff]/30 pb-24">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8">
            <div className="absolute w-full h-full bg-[#00d4ff] rounded-full animate-ping opacity-20"></div>
            <div className="relative w-3 h-3 bg-[#00d4ff] rounded-full shadow-[0_0_10px_#00d4ff]"></div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-widest text-white leading-none mb-0.5">LUMORA</h1>
            <p className="text-[9px] uppercase tracking-widest text-[#00d4ff] opacity-80 leading-none">
              {userRole === 'command' ? 'Command Center' : 'Resident Portal'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <button onClick={() => setUserRole(null)} className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white mb-1 flex items-center gap-1">
            <LogIn size={10} /> Logout
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></div>
            <span className="text-[8px] uppercase tracking-widest text-green-500/90 font-mono">System Active</span>
          </div>
        </div>
      </header>

      {userRole === 'resident' && (
        <>
          <BroadcastListener />
          {currentTab === 'dashboard' && <DashboardScreen />}
          {currentTab === 'predict' && <PredictScreen />}
          {currentTab === 'vault' && <SurvivalVaultScreen />}
          {currentTab === 'sos' && <SOSScreen />}
          {currentTab === 'ai-guide' && <AIGuideScreen />}
        </>
      )}

      {userRole === 'command' && (
        <>
          {currentTab === 'operations' && (
            <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
              {/* Command Center Stats Overview */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <ShieldAlert className="text-[#00d4ff] mb-2" size={24} />
                  <div className="text-2xl font-mono font-bold text-white">{totalAlertsCount}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">Total SOS Received</div>
                </div>
                <div className="bg-[#ff3b3b]/10 border border-[#ff3b3b]/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="text-[#ff3b3b] mb-2" size={24} />
                  <div className="text-2xl font-mono font-bold text-[#ff3b3b]">{pendingAlertsCount}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#ff3b3b]/70 mt-1">Pending Alerts</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <Users className="text-[#4ade80] mb-2" size={24} />
                  <div className="text-2xl font-mono font-bold text-[#4ade80]">142</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">Active Volunteers</div>
                </div>
              </div>

              {/* Existing Volunteer Screen */}
              <VolunteerScreen />
            </div>
          )}
          {currentTab === 'broadcast' && (
            <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
              {/* Mass Broadcast System */}
              <BroadcastSystem />
            </div>
          )}
        </>
      )}

      {/* Bottom Nav */}
      <nav 
        className="fixed bottom-0 w-full bg-[#0a0f1e]/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center z-50"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)', paddingTop: '0.5rem' }}
      >
        {userRole === 'resident' && (
          <>
            <NavItem icon={LayoutDashboard} label="Dashboard" active={currentTab === 'dashboard'} onClick={() => setCurrentTab('dashboard')} />
            <NavItem icon={BrainCircuit} label="Predict" active={currentTab === 'predict'} onClick={() => setCurrentTab('predict')} />
            <NavItem icon={Shield} label="Survival Vault" offlineBadge active={currentTab === 'vault'} onClick={() => setCurrentTab('vault')} />
            <NavItem icon={LifeBuoy} label="SOS" alert active={currentTab === 'sos'} onClick={() => setCurrentTab('sos')} />
            <NavItem icon={Bot} label="AI Guide" active={currentTab === 'ai-guide'} onClick={() => setCurrentTab('ai-guide')} />
          </>
        )}
        {userRole === 'command' && (
          <>
            <NavItem icon={ShieldAlert} label="Operations" badge={pendingAlertsCount} active={currentTab === 'operations'} onClick={() => setCurrentTab('operations')} />
            <NavItem icon={Radio} label="Broadcast" active={currentTab === 'broadcast'} onClick={() => setCurrentTab('broadcast')} />
          </>
        )}
      </nav>
    </div>
  );
}
