import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldAlert, CloudRainWind } from 'lucide-react';

// API Key for Weather Layers
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY || '';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different threat levels
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const icons = {
  CRITICAL: createCustomIcon('#ff3b3b'),
  HIGH: createCustomIcon('#ff9800'),
  MODERATE: createCustomIcon('#ffeb3b'),
  LOW: createCustomIcon('#00d4ff'),
};

interface Incident {
  id: string;
  lat: number;
  lon: number;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
}

interface InteractiveMapProps {
  center: { lat: number; lon: number };
  incidents: Incident[];
  weatherData?: {
    temp: number | null;
    humidity: number | null;
    wind: number | null;
    rain: number | null;
    pressure: number | null;
  };
}

const createWeatherIcon = (temp: number | null) => {
  if (temp === null) return new L.Icon.Default();
  return L.divIcon({
    className: 'custom-weather-icon',
    html: `<div style="background-color: rgba(10, 15, 30, 0.9); color: #00d4ff; font-weight: bold; font-family: monospace; padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(0, 212, 255, 0.5); box-shadow: 0 0 10px rgba(0, 212, 255, 0.3); white-space: nowrap; font-size: 14px; display: flex; align-items: center; gap: 4px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
      ${temp.toFixed(1)}°C
    </div>`,
    iconSize: [80, 28],
    iconAnchor: [40, 14],
  });
};

function MapUpdater({ center }: { center: { lat: number; lon: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lon], map.getZoom());
  }, [center, map]);
  return null;
}

export default function InteractiveMap({ center, incidents, weatherData }: InteractiveMapProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden relative" style={{ height: '400px' }}>
      <div className="absolute top-4 left-4 z-[400] bg-[#0a0f1e]/80 backdrop-blur-md border border-white/10 p-2 rounded-xl flex items-center gap-2">
        <ShieldAlert size={16} className="text-[#00d4ff]" />
        <span className="text-xs uppercase tracking-widest font-bold text-white">Live Incident & Weather Map</span>
      </div>
      <MapContainer 
        center={[center.lat, center.lon]} 
        zoom={12} 
        style={{ height: '100%', width: '100%', backgroundColor: '#0a0f1e' }}
        zoomControl={true}
      >
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer checked name="Dark Map">
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street Map">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          </LayersControl.BaseLayer>

          {/* Weather Union Overlays */}
          {weatherData && (
            <>
              <LayersControl.Overlay name="Rain Intensity (Weather Union)">
                <Circle
                  center={[center.lat, center.lon]}
                  radius={20000} // 20km radius
                  pathOptions={{
                    fillColor: '#0088ff',
                    fillOpacity: weatherData.rain !== null ? Math.min((weatherData.rain || 0) / 20, 0.6) + 0.1 : 0,
                    color: '#0088ff',
                    weight: 2,
                    dashArray: '5, 10'
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#0088ff] mb-1">Rain Intensity</div>
                      <div className="font-mono text-lg">{weatherData.rain ?? 0} mm/h</div>
                    </div>
                  </Popup>
                </Circle>
              </LayersControl.Overlay>

              <LayersControl.Overlay name="Wind Speed (Weather Union)">
                <Circle
                  center={[center.lat, center.lon]}
                  radius={20000}
                  pathOptions={{
                    fillColor: '#a855f7',
                    fillOpacity: weatherData.wind !== null ? Math.min((weatherData.wind || 0) / 100, 0.6) + 0.1 : 0,
                    color: '#a855f7',
                    weight: 2,
                    dashArray: '5, 10'
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#a855f7] mb-1">Wind Speed</div>
                      <div className="font-mono text-lg">{weatherData.wind ?? 0} km/h</div>
                    </div>
                  </Popup>
                </Circle>
              </LayersControl.Overlay>

              <LayersControl.Overlay name="Pressure (Weather Union)">
                <Circle
                  center={[center.lat, center.lon]}
                  radius={20000}
                  pathOptions={{
                    fillColor: '#10b981',
                    fillOpacity: weatherData.pressure !== null ? Math.min(((weatherData.pressure || 1000) - 950) / 100, 0.6) : 0,
                    color: '#10b981',
                    weight: 2,
                    dashArray: '5, 10'
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="p-1 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#10b981] mb-1">Surface Pressure</div>
                      <div className="font-mono text-lg">{weatherData.pressure ?? 1013} hPa</div>
                    </div>
                  </Popup>
                </Circle>
              </LayersControl.Overlay>
            </>
          )}
        </LayersControl>

        <MapUpdater center={center} />
        
        {/* Weather Union Station Marker */}
        {weatherData && weatherData.temp !== null && (
          <Marker 
            position={[center.lat, center.lon]} 
            icon={createWeatherIcon(weatherData.temp)}
            zIndexOffset={1000}
          >
            <Popup className="weather-popup">
              <div className="p-2 bg-[#0a0f1e] text-white rounded-lg border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] mb-2 flex items-center gap-1">
                  <CloudRainWind size={12} />
                  Weather Union Station
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div className="text-white/60">Temperature</div>
                  <div className="text-right font-mono">{weatherData.temp}°C</div>
                  <div className="text-white/60">Humidity</div>
                  <div className="text-right font-mono">{weatherData.humidity}%</div>
                  <div className="text-white/60">Wind</div>
                  <div className="text-right font-mono">{weatherData.wind} km/h</div>
                  <div className="text-white/60">Rain</div>
                  <div className="text-right font-mono">{weatherData.rain} mm/h</div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {incidents.map((incident) => (
          <Marker 
            key={incident.id} 
            position={[incident.lat, incident.lon]}
            icon={icons[incident.severity]}
          >
            <Popup className="custom-popup">
              <div className="p-1">
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: incident.severity === 'CRITICAL' ? '#ff3b3b' : incident.severity === 'HIGH' ? '#ff9800' : incident.severity === 'MODERATE' ? '#ffeb3b' : '#00d4ff' }}>
                  {incident.severity} THREAT
                </div>
                <div className="font-semibold text-gray-800 mb-1">{incident.type}</div>
                <div className="text-xs text-gray-600">{incident.description}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style>{`
        .leaflet-container {
          font-family: 'Inter', sans-serif;
          z-index: 10;
        }
        .weather-popup .leaflet-popup-content-wrapper {
          background-color: #0a0f1e;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          padding: 0;
        }
        .weather-popup .leaflet-popup-content {
          margin: 0;
        }
        .weather-popup .leaflet-popup-tip {
          background-color: #0a0f1e;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background-color: rgba(255, 255, 255, 0.95);
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .custom-popup .leaflet-popup-tip {
          background-color: rgba(255, 255, 255, 0.95);
        }
        .leaflet-control-attribution {
          background-color: rgba(10, 15, 30, 0.7) !important;
          color: rgba(255, 255, 255, 0.5) !important;
        }
        .leaflet-control-attribution a {
          color: rgba(255, 255, 255, 0.8) !important;
        }
        .leaflet-control-zoom {
          border: none !important;
        }
        .leaflet-control-zoom a {
          background-color: rgba(10, 15, 30, 0.8) !important;
          color: #00d4ff !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: rgba(0, 212, 255, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
