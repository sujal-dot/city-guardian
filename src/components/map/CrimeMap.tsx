import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { crimeHotspots, incidents } from '@/data/mockData';
import { AlertTriangle, Clock, MapPin, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

// Thane city center coordinates
const THANE_CENTER: [number, number] = [19.2183, 72.9781];
const DEFAULT_ZOOM = 13;

// Color based on risk score
const getRiskColor = (score: number) => {
  if (score >= 70) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#22c55e';
};

const getRiskLabel = (score: number) => {
  if (score >= 70) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
};

export function CrimeMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: THANE_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add hotspot circles
    crimeHotspots.forEach((hotspot) => {
      const circle = L.circle([hotspot.coordinates.lat, hotspot.coordinates.lng], {
        color: getRiskColor(hotspot.riskScore),
        fillColor: getRiskColor(hotspot.riskScore),
        fillOpacity: 0.35,
        weight: 2,
        radius: hotspot.riskScore * 15,
      }).addTo(map);

      circle.bindPopup(`
        <div style="min-width: 200px; padding: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <strong style="color: #3b82f6;">${hotspot.zone}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #94a3b8;">Risk Score</span>
            <span style="background: ${getRiskColor(hotspot.riskScore)}22; color: ${getRiskColor(hotspot.riskScore)}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
              ${hotspot.riskScore} (${getRiskLabel(hotspot.riskScore)})
            </span>
          </div>
          <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
            ⚠️ ${hotspot.predictedCrimes} predicted incidents
          </div>
          <div style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">
            🕐 Peak: ${hotspot.timeWindow}
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${hotspot.crimeTypes.map(type => `<span style="background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${type}</span>`).join('')}
          </div>
        </div>
      `);
    });

    // Add incident markers
    incidents.forEach((incident) => {
      const color = incident.riskLevel === 'critical' ? '#ef4444' :
                    incident.riskLevel === 'high' ? '#f97316' :
                    incident.riskLevel === 'medium' ? '#eab308' : '#22c55e';

      const marker = L.circleMarker([incident.coordinates.lat, incident.coordinates.lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
        radius: 8,
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 180px; padding: 8px;">
          <div style="font-family: monospace; font-size: 11px; color: #3b82f6; margin-bottom: 4px;">${incident.id}</div>
          <div style="font-weight: 600; margin-bottom: 4px;">${incident.type}</div>
          <div style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">${incident.location}</div>
          <span style="background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: capitalize;">
            ${incident.status}
          </span>
        </div>
      `);
    });

    // Fit bounds to Thane city
    map.fitBounds([
      [19.15, 72.92],
      [19.28, 73.05]
    ]);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="card-command overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Interactive Crime Heatmap</h3>
          <p className="text-sm text-muted-foreground">Thane City - Live Hotspot Visualization</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs text-muted-foreground">Real-time tracking</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[500px]">
        <div ref={mapRef} className="h-full w-full" />

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] glass p-3 rounded-lg">
          <p className="text-xs font-medium text-foreground mb-2">Risk Levels</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ef4444]" />
              <span className="text-xs text-muted-foreground">Critical (&gt;70)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#f97316]" />
              <span className="text-xs text-muted-foreground">High (50-70)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#eab308]" />
              <span className="text-xs text-muted-foreground">Medium (30-50)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-muted-foreground">Safe (&lt;30)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot Details Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {crimeHotspots.map((hotspot) => (
          <div
            key={`detail-${hotspot.id}`}
            className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium text-foreground">{hotspot.zone}</h4>
              </div>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-semibold',
                  hotspot.riskScore >= 70 && 'bg-red-500/20 text-red-400',
                  hotspot.riskScore >= 50 && hotspot.riskScore < 70 && 'bg-orange-500/20 text-orange-400',
                  hotspot.riskScore >= 30 && hotspot.riskScore < 50 && 'bg-yellow-500/20 text-yellow-400',
                  hotspot.riskScore < 30 && 'bg-green-500/20 text-green-400'
                )}
              >
                {hotspot.riskScore}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>{hotspot.predictedCrimes} predicted incidents</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Peak: {hotspot.timeWindow}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {hotspot.crimeTypes.slice(0, 2).map((type) => (
                <span
                  key={type}
                  className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
