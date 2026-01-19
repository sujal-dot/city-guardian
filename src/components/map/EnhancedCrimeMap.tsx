import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { useCrimeData } from '@/hooks/useCrimeData';
import { useIncidents } from '@/hooks/useIncidents';
import { useCrimePrediction, CrimeRecord } from '@/hooks/useCrimePrediction';
import { AlertTriangle, Clock, MapPin, Crosshair, Loader2, Layers, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Extend L type to include heatLayer
declare module 'leaflet' {
  function heatLayer(latlngs: Array<[number, number, number]>, options?: any): L.Layer;
}
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

// Heatmap intensity based on crime frequency
const getHeatIntensity = (incidentCount: number) => {
  if (incidentCount >= 20) return 1;
  if (incidentCount >= 10) return 0.7;
  if (incidentCount >= 5) return 0.5;
  return 0.3;
};

export function EnhancedCrimeMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const circlesLayerRef = useRef<L.LayerGroup | null>(null);

  const { crimeData, isLoading: crimeLoading } = useCrimeData();
  const { incidents, isLoading: incidentsLoading } = useIncidents();
  const { crimeData: csvData, isLoadingData: csvLoading } = useCrimePrediction();

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showCircles, setShowCircles] = useState(true);
  const [showCSVData, setShowCSVData] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize map
    const map = L.map(mapRef.current, {
      center: THANE_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    mapInstanceRef.current = map;

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Create layer groups
    markersLayerRef.current = L.layerGroup().addTo(map);
    circlesLayerRef.current = L.layerGroup().addTo(map);

    // Fit bounds to Thane city
    map.fitBounds([
      [19.15, 72.92],
      [19.28, 73.05],
    ]);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Memoize and sample CSV data to prevent performance issues
  const sampledCsvData = useMemo(() => {
    if (csvData.length <= 500) return csvData;
    // Sample every nth record to keep ~500 points
    const step = Math.ceil(csvData.length / 500);
    return csvData.filter((_, index) => index % step === 0);
  }, [csvData]);

  // Update heatmap layer with CSV data
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing heatmap
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (!showHeatmap || !showCSVData) return;

    // Create heatmap data from sampled CSV
    const heatData: [number, number, number][] = [];
    
    // Add sampled CSV crime data points
    sampledCsvData.forEach((record: CrimeRecord) => {
      if (record.latitude && record.longitude && 
          !isNaN(record.latitude) && !isNaN(record.longitude)) {
        heatData.push([record.latitude, record.longitude, 0.5]);
      }
    });

    // Add database crime data with intensity based on risk score
    crimeData.forEach((data) => {
      const intensity = data.risk_score / 100;
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        heatData.push([lat, lng, intensity]);
      }
    });

    if (heatData.length > 0) {
      // Use leaflet.heat for efficient heatmap rendering
      const heatLayer = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: 1.0,
        gradient: {
          0.0: '#22c55e',
          0.25: '#eab308',
          0.5: '#f97316',
          0.75: '#ef4444',
          1.0: '#dc2626',
        },
      });

      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;
    }
  }, [sampledCsvData, crimeData, showHeatmap, showCSVData]);

  // Update crime data circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const circlesLayer = circlesLayerRef.current;
    if (!map || !circlesLayer) return;

    circlesLayer.clearLayers();

    if (!showCircles) return;

    crimeData.forEach((data) => {
      const circle = L.circle([Number(data.latitude), Number(data.longitude)], {
        color: getRiskColor(data.risk_score),
        fillColor: getRiskColor(data.risk_score),
        fillOpacity: 0.35,
        weight: 2,
        radius: data.risk_score * 15,
      });

      circle.bindPopup(`
        <div style="min-width: 200px; padding: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <strong style="color: #3b82f6;">${data.zone_name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #94a3b8;">Risk Score</span>
            <span style="background: ${getRiskColor(data.risk_score)}22; color: ${getRiskColor(data.risk_score)}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
              ${data.risk_score} (${getRiskLabel(data.risk_score)})
            </span>
          </div>
          <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
            ⚠️ ${data.incident_count} recorded incidents
          </div>
          <div style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">
            📍 Type: ${data.crime_type}
          </div>
        </div>
      `);

      circlesLayer.addLayer(circle);
    });
  }, [crimeData, showCircles]);

  // Update incident markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (!showMarkers) return;

    incidents.forEach((incident) => {
      const color =
        incident.severity === 'critical'
          ? '#ef4444'
          : incident.severity === 'high'
          ? '#f97316'
          : incident.severity === 'medium'
          ? '#eab308'
          : '#22c55e';

      const marker = L.circleMarker(
        [Number(incident.latitude), Number(incident.longitude)],
        {
          color: color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 2,
          radius: 8,
        }
      );

      marker.bindPopup(`
        <div style="min-width: 180px; padding: 8px;">
          <div style="font-family: monospace; font-size: 11px; color: #3b82f6; margin-bottom: 4px;">${incident.id.slice(0, 8)}</div>
          <div style="font-weight: 600; margin-bottom: 4px;">${incident.title}</div>
          <div style="color: #94a3b8; font-size: 13px; margin-bottom: 8px;">${incident.location_name}</div>
          <span style="background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: capitalize;">
            ${incident.status}
          </span>
        </div>
      `);

      markersLayer.addLayer(marker);
    });
  }, [incidents, showMarkers]);

  const isLoading = crimeLoading || incidentsLoading || csvLoading;

  return (
    <div className="card-command overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Interactive Crime Heatmap
          </h3>
          <p className="text-sm text-muted-foreground">
            Thane City - Live Hotspot Visualization with {csvData.length} data points
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4 text-primary animate-pulse" />
            )}
            <span className="text-xs text-muted-foreground">
              {isLoading ? 'Loading data...' : 'Real-time tracking'}
            </span>
          </div>
        </div>
      </div>

      {/* Layer Controls */}
      <div className="px-6 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Layers:</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="heatmap"
              checked={showHeatmap}
              onCheckedChange={setShowHeatmap}
            />
            <Label htmlFor="heatmap" className="text-xs">Heatmap</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="circles"
              checked={showCircles}
              onCheckedChange={setShowCircles}
            />
            <Label htmlFor="circles" className="text-xs">Risk Zones</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="markers"
              checked={showMarkers}
              onCheckedChange={setShowMarkers}
            />
            <Label htmlFor="markers" className="text-xs">Incidents</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="csvData"
              checked={showCSVData}
              onCheckedChange={setShowCSVData}
            />
            <Label htmlFor="csvData" className="text-xs">Historical Data</Label>
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

        {/* Stats Overlay */}
        <div className="absolute top-4 right-4 z-[1000] glass p-3 rounded-lg">
          <p className="text-xs font-medium text-foreground mb-2">Data Sources</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-muted-foreground">CSV Records:</span>
              <span className="text-foreground font-medium">{csvData.length}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-muted-foreground">DB Hotspots:</span>
              <span className="text-foreground font-medium">{crimeData.length}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-muted-foreground">Live Incidents:</span>
              <span className="text-foreground font-medium">{incidents.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot Details Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {crimeData.slice(0, 8).map((data) => (
          <div
            key={data.id}
            className="p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium text-foreground">{data.zone_name}</h4>
              </div>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-xs font-semibold',
                  data.risk_score >= 70 && 'bg-red-500/20 text-red-400',
                  data.risk_score >= 50 &&
                    data.risk_score < 70 &&
                    'bg-orange-500/20 text-orange-400',
                  data.risk_score >= 30 &&
                    data.risk_score < 50 &&
                    'bg-yellow-500/20 text-yellow-400',
                  data.risk_score < 30 && 'bg-green-500/20 text-green-400'
                )}
              >
                {data.risk_score}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>{data.incident_count} recorded incidents</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Type: {data.crime_type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
