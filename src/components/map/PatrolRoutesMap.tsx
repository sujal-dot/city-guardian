import { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCrimeData } from '@/hooks/useCrimeData';
import { Button } from '@/components/ui/button';

const THANE_CENTER: [number, number] = [19.2183, 72.9781];
const DEFAULT_ZOOM = 13;

type RouteStop = { name: string; lat: number; lng: number; risk?: number };

interface PatrolRoutesMapProps {
  routeStops?: RouteStop[];
  routeLabel?: string;
  routeWindow?: string;
  onClearRoute?: () => void;
}

export function PatrolRoutesMap({ routeStops, routeLabel, routeWindow, onClearRoute }: PatrolRoutesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const highlightLayerRef = useRef<L.Polyline | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const { crimeData, isLoading } = useCrimeData();
  const [steps, setSteps] = useState<
    { instruction: string; name?: string; distance: number; duration: number; from: number; to: number }[]
  >([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const directionsContainerRef = useRef<HTMLDivElement | null>(null);
  const stepsRefs = useRef<(HTMLLIElement | null)[]>([]);
  const isSuggestionRoute = Boolean(routeStops && routeStops.length > 0);

  const targets = useMemo(() => {
    if (isSuggestionRoute) {
      return (routeStops ?? []).map((stop, idx) => ({
        id: `route-${idx + 1}`,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        risk: stop.risk,
      }));
    }
    const sorted = [...crimeData].sort((a, b) => b.risk_score - a.risk_score);
    const highRisk = sorted.filter((d) => d.risk_score >= 50);
    const top = (highRisk.length > 0 ? highRisk : sorted).slice(0, 6);
    return top.map((d) => ({
      id: d.id,
      name: d.zone_name,
      lat: Number(d.latitude),
      lng: Number(d.longitude),
      risk: d.risk_score,
    }));
  }, [crimeData, isSuggestionRoute, routeStops]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current, {
      center: THANE_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  const drawRoadRoute = async (points: { lat: number; lng: number }[]) => {
    const map = mapInstanceRef.current;
    if (!map || points.length < 2) return;
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (highlightLayerRef.current) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null;
    }
    setSteps([]);
    try {
      const coordsParam = points
        .map((p) => `${p.lng},${p.lat}`) // OSRM expects lon,lat
        .join(';');
      const rawKey = import.meta.env.VITE_ORS_API_KEY as string | undefined;
      let orsKey: string | undefined = rawKey;
      if (rawKey && /^[A-Za-z0-9+/=]+$/.test(rawKey)) {
        try {
          const decoded = atob(rawKey);
          type ORSKeyPayload = { org?: string; id?: string; h?: string };
          const payload = JSON.parse(decoded) as ORSKeyPayload;
          if (payload.org) {
            orsKey = payload.org;
          }
        } catch {
          // ignore parse errors, use rawKey as-is
        }
      }
      let routeCoords: [number, number][] = [];

      if (orsKey) {
        try {
          const body = {
            coordinates: points.map((p) => [p.lng, p.lat]),
            instructions: true,
            geometry: true,
          };
          const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: orsKey,
              Accept: 'application/json',
            },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const data = await res.json();
            const coords = data?.features?.[0]?.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length > 0) {
              routeCoords = coords.map((c: [number, number]) => [c[1], c[0]]);
            }
            const segs = data?.features?.[0]?.properties?.segments as
              | { steps?: { instruction?: string; name?: string; distance?: number; duration?: number; way_points?: number[] }[] }[]
              | undefined;
            const s =
              Array.isArray(segs)
                ? segs.flatMap((seg) =>
                    Array.isArray(seg.steps)
                      ? seg.steps.map((st) => ({
                        instruction: String(st.instruction || ''),
                        name: st.name ? String(st.name) : undefined,
                        distance: Number(st.distance || 0),
                        duration: Number(st.duration || 0),
                        from: Number(Array.isArray(st.way_points) ? st.way_points[0] ?? 0 : 0),
                        to: Number(Array.isArray(st.way_points) ? st.way_points[1] ?? 0 : 0),
                      }))
                      : []
                  )
                : [];
            if (s.length > 0) setSteps(s);
          }
        } catch (err) {
          console.error('ORS request failed');
        }
      }

      if (routeCoords.length === 0) {
        const urls = [
          `http://router.project.osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`,
          `https://router.project.osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`,
        ];
        for (const u of urls) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const data = await res.json();
            const coords = data?.routes?.[0]?.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length > 0) {
              routeCoords = coords.map((c: [number, number]) => [c[1], c[0]]);
              break;
            }
          } catch {
            continue;
          }
        }
      }
      if (routeCoords.length > 0) {
        routeCoordsRef.current = routeCoords;
        routeLayerRef.current = L.polyline(routeCoords, {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.95,
        }).addTo(map);
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
      } else {
        const latlngs = points.map((t) => [t.lat, t.lng]) as [number, number][];
        routeLayerRef.current = L.polyline(latlngs, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.9,
        }).addTo(map);
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
      }
    } catch {
      // Fallback to straight polyline if routing fails
      const latlngs = points.map((t) => [t.lat, t.lng]) as [number, number][];
      routeLayerRef.current = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
    }
  };

  useEffect(() => {
    if (steps.length > 0) {
      setCurrentStepIndex(0);
    } else {
      setCurrentStepIndex(-1);
    }
  }, [steps]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (currentStepIndex < 0) {
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
        highlightLayerRef.current = null;
      }
      return;
    }
    const coords = routeCoordsRef.current;
    const step = steps[currentStepIndex];
    if (!step || coords.length === 0) return;
    const from = Math.max(0, step.from | 0);
    const to = Math.min(coords.length - 1, step.to | 0);
    if (to <= from) return;
    const seg = coords.slice(from, to + 1);
    if (highlightLayerRef.current) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null;
    }
    highlightLayerRef.current = L.polyline(seg, {
      color: '#f59e0b',
      weight: 7,
      opacity: 1,
    }).addTo(map);
    map.fitBounds(highlightLayerRef.current.getBounds(), { padding: [20, 20], maxZoom: 17 });
  }, [currentStepIndex, steps]);

  useEffect(() => {
    const root = directionsContainerRef.current;
    if (!root || steps.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = -1;
        let bestRatio = 0;
        entries.forEach((entry) => {
          const idx = stepsRefs.current.indexOf(entry.target as HTMLLIElement);
          if (idx !== -1 && entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = idx;
          }
        });
        if (bestIndex !== -1 && bestIndex !== currentStepIndex) {
          setCurrentStepIndex(bestIndex);
        }
      },
      { root, threshold: 0.6 }
    );
    stepsRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [steps, currentStepIndex]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (highlightLayerRef.current) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null;
    }
    routeCoordsRef.current = [];
    setSteps([]);

    targets.forEach((t, idx) => {
      const marker = L.marker([t.lat, t.lng], {
        icon: L.divIcon({
          className: 'patrol-point-icon',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            background: hsl(217, 91%, 60%);
            color: hsl(222, 47%, 11%);
            font-weight:700;font-size:12px;border:2px solid #1e293b;
            box-shadow: 0 0 10px rgba(59,130,246,0.5);
          ">${idx + 1}</div>`,
        }),
      });
      marker.bindPopup(`
        <div style="min-width:200px;padding:6px;">
          <strong style="color:#93c5fd;">${t.name}</strong>
          <div style="margin-top:6px;color:#94a3b8;font-size:12px;">
            ${typeof t.risk === 'number' ? `Risk Score: ${t.risk}` : 'Route Stop'}
          </div>
        </div>
      `);
      marker.addTo(layer);
    });

    if (targets.length >= 2) {
      drawRoadRoute(targets);
    }
  }, [targets]);

  const formatDistance = (m: number) => {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m)} m`;
  };
  const formatDuration = (s: number) => {
    const mins = Math.round(s / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  };

  return (
    <div className="card-command overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {isSuggestionRoute ? 'Selected Patrol Route' : 'Patrol Routes from Heatmap'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isSuggestionRoute
              ? routeLabel || 'Preview directions for the selected patrol suggestion'
              : 'Road-following patrol path across top high-risk zones'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuggestionRoute && onClearRoute && (
            <Button variant="outline" size="sm" onClick={onClearRoute}>
              Show Heatmap
            </Button>
          )}
          <div className="text-xs text-muted-foreground text-right">
            {isSuggestionRoute && routeWindow && <div>{routeWindow}</div>}
            <div>
              {isSuggestionRoute
                ? `Targets: ${targets.length}`
                : isLoading
                  ? 'Loading heatmap data…'
                  : `Targets: ${targets.length}`}
            </div>
          </div>
        </div>
      </div>
      <div className="relative h-[480px]">
        <div ref={mapRef} className="h-full w-full" />
        {steps.length > 0 && (
          <div ref={directionsContainerRef} className="absolute top-4 right-4 z-[1000] glass p-3 rounded-lg max-w-sm max-h-[400px] overflow-auto">
            <div className="mb-2">
              <p className="text-sm font-medium text-foreground">Route Summary</p>
              <p className="text-xs text-muted-foreground">
                {formatDistance(steps.reduce((sum, st) => sum + st.distance, 0))} • {formatDuration(steps.reduce((sum, st) => sum + st.duration, 0))}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground mb-2">Directions</p>
            <ol className="space-y-2">
              {steps.map((st, i) => (
                <li
                  key={i}
                  ref={(el) => (stepsRefs.current[i] = el)}
                  className={`text-xs cursor-pointer ${i === currentStepIndex ? 'text-foreground bg-primary/10 rounded px-2 py-1' : 'text-muted-foreground'}`}
                  onMouseEnter={() => setCurrentStepIndex(i)}
                  onClick={() => {
                    setCurrentStepIndex(i);
                    const el = stepsRefs.current[i];
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <span className="font-semibold text-foreground mr-1">{i + 1}.</span>
                  <span>{st.instruction}</span>
                  {st.name && <span>{' '}on {st.name}</span>}
                  <span className="block mt-0.5">
                    {formatDistance(st.distance)} • {formatDuration(st.duration)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
