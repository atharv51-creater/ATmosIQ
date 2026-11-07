import React, { useState, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap
} from '@vis.gl/react-google-maps';
import { ZonesGeoJson, ZoneFeature, WindVector, Emitter, RegionInfo } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Wind,
  Layers,
  Play,
  Pause,
  Factory,
  Globe,
  Download,
  ExternalLink,
  Box,
  X,
  Compass,
  CheckCircle2,
  Info,
  MapPin,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface MapGridProps {
  zones: ZonesGeoJson | null;
  selectedCellId: string | null;
  onSelectZone: (cellId: string) => void;
  windData: WindVector[] | null;
  showWind: boolean;
  onToggleWind: () => void;
  horizon: number;
  onHorizonChange: (h: number) => void;
  emitters?: Emitter[];
  selectedRegion?: string;
  onRegionChange?: (region: string) => void;
  regionsList?: RegionInfo[];
  onOpenWeatherTab?: () => void;
}

const DEFAULT_INDIA_CENTER = { lat: 21.7679, lng: 78.8718 };

// Deep obsidian blue-black map styles for night theme
const DARK_BLUE_BLACK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#090e1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#090e1a' }, { weight: 2 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7993af' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9bb8d7' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#627d98' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#071622' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#131e33' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0c1524' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1d2c49' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0b1422' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#16233b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#040810' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#385273' }] },
];

// Helper to determine risk colors
const getRiskColor = (riskClass: string) => {
  switch (riskClass) {
    case 'Critical':
      return '#dc2626'; // Deep Crimson
    case 'High':
      return '#ea580c'; // Warm Orange
    case 'Moderate':
      return '#d97706'; // Amber Ochre
    case 'Low':
      return '#059669'; // Forest Green
    default:
      return '#94a3b8';
  }
};

/**
 * Camera Recenter Helper Hook/Component
 */
const CameraRecenterEffect: React.FC<{
  selectedRegion?: string;
  regionsList?: RegionInfo[];
}> = ({ selectedRegion, regionsList }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedRegion && selectedRegion !== 'all' && selectedRegion !== 'india') {
      const reg = regionsList?.find((r) => r.id === selectedRegion);
      if (reg) {
        map.panTo(reg.center);
        map.setZoom(reg.zoom);
      }
    } else {
      map.panTo(DEFAULT_INDIA_CENTER);
      map.setZoom(5);
    }
  }, [map, selectedRegion, regionsList]);

  return null;
};

/**
 * Subcomponent to render and synchronize GeoJSON hex polygons via Google Maps Data layer
 */
const HexCadastreDataLayer: React.FC<{
  zones: ZonesGeoJson | null;
  selectedCellId: string | null;
  hoveredCellId: string | null;
  onSelectZone: (cellId: string) => void;
  onHoverFeature: (feat: ZoneFeature | null, x?: number, y?: number) => void;
}> = ({ zones, selectedCellId, hoveredCellId, onSelectZone, onHoverFeature }) => {
  const map = useMap();
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const mouseOverListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const mouseOutListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  // Setup click and hover event listeners on map.data
  useEffect(() => {
    if (!map) return;
    const data = map.data;

    if (clickListenerRef.current) google.maps.event.removeListener(clickListenerRef.current);
    if (mouseOverListenerRef.current) google.maps.event.removeListener(mouseOverListenerRef.current);
    if (mouseOutListenerRef.current) google.maps.event.removeListener(mouseOutListenerRef.current);

    clickListenerRef.current = data.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const cellId = event.feature.getProperty('cell_id');
      if (cellId !== undefined && cellId !== null) {
        onSelectZone(String(cellId));
      }
    });

    mouseOverListenerRef.current = data.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
      const cellId = event.feature.getProperty('cell_id');
      if (!cellId) return;

      const properties = {
        cell_id: cellId,
        name: event.feature.getProperty('name'),
        region_name: event.feature.getProperty('region_name'),
        score: event.feature.getProperty('score'),
        risk_class: event.feature.getProperty('risk_class'),
        pm25: event.feature.getProperty('pm25'),
        aqi_est: event.feature.getProperty('aqi_est'),
        population: event.feature.getProperty('population'),
        top_factors: event.feature.getProperty('top_factors') || []
      };

      const domEvent = event.domEvent as MouseEvent | undefined;
      const x = domEvent?.clientX;
      const y = domEvent?.clientY;

      onHoverFeature({ properties } as any, x, y);
    });

    mouseOutListenerRef.current = data.addListener('mouseout', () => {
      onHoverFeature(null);
    });

    return () => {
      if (clickListenerRef.current) google.maps.event.removeListener(clickListenerRef.current);
      if (mouseOverListenerRef.current) google.maps.event.removeListener(mouseOverListenerRef.current);
      if (mouseOutListenerRef.current) google.maps.event.removeListener(mouseOutListenerRef.current);
    };
  }, [map, onSelectZone, onHoverFeature]);

  // Load / Reload GeoJSON features whenever `zones` changes
  useEffect(() => {
    if (!map || !zones) return;
    const data = map.data;

    data.forEach((feature) => {
      data.remove(feature);
    });

    try {
      data.addGeoJson(zones);
    } catch (e) {
      console.error('Error adding GeoJSON to Google Maps:', e);
    }
  }, [map, zones]);

  // Dynamically update polygon styling on hover or selection changes
  useEffect(() => {
    if (!map) return;
    map.data.setStyle((feature) => {
      const riskClass = String(feature.getProperty('risk_class') || 'Moderate');
      const cellId = String(feature.getProperty('cell_id') || '');
      const isSelected = cellId === selectedCellId;
      const isHovered = cellId === hoveredCellId;
      const fillColor = getRiskColor(riskClass);

      return {
        fillColor,
        fillOpacity: isSelected ? 0.82 : isHovered ? 0.70 : 0.48,
        strokeColor: isSelected ? '#0f172a' : isHovered ? '#1e293b' : '#ffffff',
        strokeWeight: isSelected ? 3.5 : isHovered ? 2.5 : 1.2,
        zIndex: isSelected ? 10 : isHovered ? 5 : 1,
        cursor: 'pointer'
      };
    });
  }, [map, selectedCellId, hoveredCellId]);

  return null;
};

/**
 * Subcomponent to render wind vectors as Google Maps Polylines with arrowheads
 */
const WindVectorsLayer: React.FC<{
  windData: WindVector[] | null;
  showWind: boolean;
}> = ({ windData, showWind }) => {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((line) => line.setMap(null));
    polylinesRef.current = [];

    if (!map || !showWind || !windData || windData.length === 0) return;

    const newLines: google.maps.Polyline[] = [];
    const scale = 0.0035;

    windData.forEach((w) => {
      const start = { lat: w.lat, lng: w.lon };
      const end = { lat: w.lat + w.wind_v * scale, lng: w.lon + w.wind_u * scale };
      const spd = w.wind_speed || 0;
      const strokeColor = spd < 2.0 ? '#38bdf8' : spd < 3.5 ? '#0284c7' : '#1e1b4b';

      const polyline = new google.maps.Polyline({
        path: [start, end],
        strokeColor,
        strokeOpacity: 0.90,
        strokeWeight: spd > 3.5 ? 2.5 : 2,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: spd > 3.5 ? 2.6 : 2.2,
              fillColor: strokeColor,
              fillOpacity: 0.95,
              strokeColor: '#ffffff',
              strokeWeight: 0.75
            },
            offset: '100%'
          }
        ],
        map
      });

      newLines.push(polyline);
    });

    polylinesRef.current = newLines;

    return () => {
      newLines.forEach((line) => line.setMap(null));
    };
  }, [map, windData, showWind]);

  return null;
};

/**
 * Main Google Maps Grid View with Pan-India Scope & Google Earth Pro Connection
 */
export const MapGrid: React.FC<MapGridProps> = ({
  zones,
  selectedCellId,
  onSelectZone,
  windData,
  showWind,
  onToggleWind,
  horizon,
  onHorizonChange,
  emitters = [],
  selectedRegion = 'all',
  onRegionChange,
  regionsList = [],
  onOpenWeatherTab
}) => {
  const { isDark } = useTheme();
  const [apiKey, setApiKey] = useState<string>(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'terrain'>('roadmap');
  const [isPlaying, setIsPlaying] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [showEmitters, setShowEmitters] = useState(true);
  const [showWeatherHud, setShowWeatherHud] = useState(true);
  const [hoveredFeature, setHoveredFeature] = useState<ZoneFeature | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showEarthModal, setShowEarthModal] = useState(false);

  // Compute live atmospheric indicators for active region
  const sampleWind = windData && windData.length > 0 ? windData[0] : null;
  const avgWindSpeedKmh = windData && windData.length > 0
    ? (windData.reduce((a, b) => a + (b.wind_speed_kmh || (b.wind_speed * 3.6)), 0) / windData.length).toFixed(1)
    : '8.2';
  const avgPblh = windData && windData.length > 0
    ? Math.round(windData.reduce((a, b) => a + (b.boundary_layer_height || 620), 0) / windData.length)
    : 620;
  const avgVent = windData && windData.length > 0
    ? Math.round(windData.reduce((a, b) => a + (b.ventilation_coefficient || 2400), 0) / windData.length)
    : 2400;
  const avgTemp = windData && windData.length > 0
    ? (windData.reduce((a, b) => a + (b.temperature_c || 25), 0) / windData.length).toFixed(1)
    : '25.0';
  const cardinal = sampleWind?.wind_cardinal || 'NW';

  // Retrieve API key if not populated in env at build time
  useEffect(() => {
    if (!apiKey) {
      fetch('/config/maps')
        .then((r) => r.json())
        .then((data) => {
          if (data.apiKey) setApiKey(data.apiKey);
        })
        .catch(() => {});
    }
  }, [apiKey]);

  // Auto-playback loop across forecast horizons (0, 1, 2, 3)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onHorizonChange((horizon + 1) % 4);
    }, 1400);
    return () => clearInterval(interval);
  }, [isPlaying, horizon, onHorizonChange]);

  const horizonLabels = ['Now (T+0)', '+24h (T+1d)', '+48h (T+2d)', '+72h (T+3d)'];
  const activeRegInfo = regionsList.find((r) => r.id === selectedRegion);
  const activeRegionLabel = activeRegInfo ? activeRegInfo.name : 'All India (National Grid)';
  const activeCellCount = zones?.features.length ?? 0;

  const toggle3D = () => {
    if (!is3D) {
      setIs3D(true);
      setMapType('satellite');
    } else {
      setIs3D(false);
    }
  };

  // Google Earth Web deep-link target coordinates
  const earthCenter = activeRegInfo
    ? `${activeRegInfo.center.lat},${activeRegInfo.center.lng},${activeRegInfo.zoom <= 6 ? '1200a,2500000d' : '560a,35000d'}`
    : '21.7679,78.8718,1200a,2500000d';

  return (
    <div className="relative w-full h-[620px] bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden select-none shadow-sm flex flex-col transition-colors duration-300">
      {/* Top Left Cadastre Context Bar with Region Selector */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-xs transition-colors duration-300">
        <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{activeRegionLabel}</span>
        </div>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">{activeCellCount} Cadastre Cells</span>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-[#080d19] px-2 py-0.5 rounded text-[11px] border border-transparent dark:border-slate-800">
          {horizonLabels[horizon]}
        </span>
      </div>

      {/* Top Right Controls Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
        {/* Google Earth Pro Connect Button */}
        <button
          onClick={() => setShowEarthModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition shadow-2xs"
          title="Connect to Google Earth Pro & 3D Extruded Cadastre"
        >
          <Globe size={13} className="text-blue-600 dark:text-blue-400" />
          <span>Google Earth Pro</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

        {/* 3D Earth Perspective Toggle */}
        <button
          onClick={toggle3D}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition ${
            is3D
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#142038]'
          }`}
          title="Toggle 3D Oblique Earth Tilt (55° Heading)"
        >
          <Box size={13} />
          <span>{is3D ? '2D View' : '3D Earth'}</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

        {/* Horizon Playback */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition ${
            isPlaying
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#142038]'
          }`}
          title={isPlaying ? 'Pause forecast animation' : 'Play 3-day forecast progression'}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

        {/* Map Type Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-[#080d19] p-0.5 rounded-md text-[11px] border border-transparent dark:border-slate-800">
          <button
            onClick={() => {
              setMapType('roadmap');
              if (is3D) setIs3D(false);
            }}
            className={`px-2 py-0.5 rounded font-medium transition ${
              mapType === 'roadmap' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => {
              setMapType('terrain');
              if (is3D) setIs3D(false);
            }}
            className={`px-2 py-0.5 rounded font-medium transition ${
              mapType === 'terrain' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Terrain
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-2 py-0.5 rounded font-medium transition ${
              mapType === 'satellite' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Satellite
          </button>
        </div>

        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-0.5"></div>

        {/* Overlays Toggle */}
        <button
          onClick={onToggleWind}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition ${
            showWind
              ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#142038]'
          }`}
          title="Toggle meteorological wind vectors"
        >
          <Wind size={13} />
          <span>Wind ({avgWindSpeedKmh} km/h)</span>
        </button>

        {showWind && (
          <button
            onClick={() => setShowWeatherHud(!showWeatherHud)}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition ${
              showWeatherHud
                ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#142038] border border-slate-200 dark:border-slate-700'
            }`}
            title="Toggle Atmospheric Telemetry HUD over map"
          >
            <span>HUD</span>
          </button>
        )}

        <button
          onClick={() => setShowEmitters(!showEmitters)}
          className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition ${
            showEmitters
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#142038]'
          }`}
          title="Toggle industrial emission points"
        >
          <Factory size={13} />
          <span>Emitters</span>
        </button>

        {onOpenWeatherTab && (
          <button
            onClick={onOpenWeatherTab}
            className="hidden md:flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-md transition ml-auto"
            title="Open comprehensive Synoptic Weather & Dispersion Radar"
          >
            <Compass size={13} />
            <span>Weather Radar</span>
          </button>
        )}
      </div>

      {/* Main Google Maps Viewport */}
      <div className="w-full h-full relative">
        <APIProvider apiKey={apiKey} language="en" region="IN">
          <GoogleMap
            defaultCenter={DEFAULT_INDIA_CENTER}
            defaultZoom={5}
            tilt={is3D ? 55 : 0}
            heading={is3D ? 320 : 0}
            mapId="DEMO_MAP_ID"
            mapTypeId={mapType}
            colorScheme={isDark ? 'DARK' : 'LIGHT'}
            styles={isDark ? (DARK_BLUE_BLACK_MAP_STYLE as any) : undefined}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Camera Recenter on Region Selection */}
            <CameraRecenterEffect selectedRegion={selectedRegion} regionsList={regionsList} />

            {/* GeoJSON Hexagon Cadastre Layer */}
            <HexCadastreDataLayer
              zones={zones}
              selectedCellId={selectedCellId}
              hoveredCellId={hoveredFeature?.properties.cell_id || null}
              onSelectZone={onSelectZone}
              onHoverFeature={(feat, x, y) => {
                setHoveredFeature(feat);
                if (x !== undefined && y !== undefined) {
                  setTooltipPos({ x, y });
                }
              }}
            />

            {/* Meteorological Wind Streams */}
            <WindVectorsLayer windData={windData} showWind={showWind} />

            {/* Industrial Emitter Markers */}
            {showEmitters &&
              emitters.map(([lat, lon, weight], idx) => (
                <AdvancedMarker
                  key={`emitter-${idx}`}
                  position={{ lat, lng: lon }}
                  title={`Industrial Emitter Source (Intensity: ${weight.toFixed(1)})`}
                >
                  <div className="relative group cursor-pointer flex items-center justify-center">
                    <span
                      className="absolute rounded-full bg-purple-500/30 animate-ping pointer-events-none"
                      style={{
                        width: `${Math.max(16, 12 + weight * 10)}px`,
                        height: `${Math.max(16, 12 + weight * 10)}px`
                      }}
                    />
                    <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-purple-700 text-white shadow-md border-2 border-white text-[10px]">
                      <Factory size={11} />
                    </div>
                  </div>
                </AdvancedMarker>
              ))}
          </GoogleMap>
        </APIProvider>
      </div>

      {/* Hover Zone Inspection Card Tooltip */}
      {hoveredFeature && (
        <div
          className="absolute z-30 pointer-events-none bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xl text-xs w-68 transform -translate-x-1/2 -translate-y-full -mt-4 animate-in fade-in duration-75 transition-colors"
          style={{
            left: `${tooltipPos?.x ? Math.max(140, Math.min(window.innerWidth - 140, tooltipPos.x)) : 200}px`,
            top: `${tooltipPos?.y ? Math.max(180, tooltipPos.y) : 250}px`
          }}
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block text-xs">
                {hoveredFeature.properties.name || `Zone ${hoveredFeature.properties.cell_id.slice(0, 8)}...`}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {hoveredFeature.properties.region_name || 'India'}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                hoveredFeature.properties.risk_class === 'Critical'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : hoveredFeature.properties.risk_class === 'High'
                  ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                  : hoveredFeature.properties.risk_class === 'Moderate'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {hoveredFeature.properties.risk_class}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 py-1">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Risk Index</span>
              <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                {hoveredFeature.properties.score}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/100</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Est. PM2.5</span>
              <span className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono">
                {hoveredFeature.properties.pm25}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal"> µg/m³</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">AQI Equivalent</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                {hoveredFeature.properties.aqi_est}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Exposed Population</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                {Number(hoveredFeature.properties.population || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {hoveredFeature.properties.top_factors && hoveredFeature.properties.top_factors.length > 0 && (
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Primary Local Driver:</span>
              <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug block">
                • {hoveredFeature.properties.top_factors[0]}
              </span>
            </div>
          )}
          <div className="mt-1.5 text-[9px] text-slate-400 dark:text-slate-500 text-right">Click polygon to open zone report</div>
        </div>
      )}

      {/* Floating Synoptic Atmospheric Conditions HUD */}
      {showWind && showWeatherHud && windData && windData.length > 0 && (
        <div className="absolute top-16 left-4 z-20 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-lg text-xs w-72 space-y-2.5 animate-in fade-in duration-100 transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
              <span className="font-bold text-slate-900 dark:text-white">Atmospheric Telemetry</span>
            </div>
            {onOpenWeatherTab && (
              <button
                onClick={onOpenWeatherTab}
                className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-300 flex items-center gap-0.5"
              >
                <span>Full Radar</span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="bg-slate-50 dark:bg-[#080d19] p-2 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Surface Wind</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {avgWindSpeedKmh}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">km/h</span>
                <span className="text-[10px] text-sky-700 dark:text-sky-400 font-bold ml-auto">
                  {cardinal}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#080d19] p-2 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Mixing Depth</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {avgPblh}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">m PBLH</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#080d19] p-2 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Ventilation (Vc)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {avgVent.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">m²/s</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#080d19] p-2 rounded border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Thermodynamics</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {avgTemp}°C
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans ml-auto">
                  {sampleWind?.humidity_pct ?? 55}% RH
                </span>
              </div>
            </div>
          </div>

          <div className="pt-1 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span>Status: <strong className="text-slate-800 dark:text-slate-200">{sampleWind?.dispersion_category ?? 'Moderate Dispersion'}</strong></span>
            <span className="text-slate-400 dark:text-slate-500 font-mono">CPCB SAFAR</span>
          </div>
        </div>
      )}

      {/* Bottom Map Legend */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-xs transition-colors duration-300">
        <div className="flex items-center gap-4">
          <span className="text-slate-600 dark:text-slate-400 font-semibold text-[11px]">Risk Scale:</span>
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
              <span className="text-slate-700 dark:text-slate-300 text-[11px]">Low (0–25)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-600"></span>
              <span className="text-slate-700 dark:text-slate-300 text-[11px]">Moderate (25–50)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-600"></span>
              <span className="text-slate-700 dark:text-slate-300 text-[11px]">High (50–75)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-600"></span>
              <span className="text-slate-700 dark:text-slate-300 text-[11px]">Critical (75–100)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span> Industrial Emitters
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-sky-600 dark:bg-sky-400 inline-block"></span> Wind Dispersion
          </span>
          <span>•</span>
          <span className="text-blue-700 dark:text-blue-400 font-medium">Pan-India KML Ready</span>
        </div>
      </div>

      {/* Google Earth Pro Connection Modal */}
      {showEarthModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1322] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100 transition-colors">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#080d19]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Globe size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Google Earth Pro Bridge</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pan-India 3D Extrusions & KML Geospatial Export</p>
                </div>
              </div>
              <button
                onClick={() => setShowEarthModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Connect and visualize the environmental cadastre for <strong>{activeRegionLabel}</strong> ({activeCellCount} zones) directly inside <strong>Google Earth Pro</strong> (Desktop) or <strong>Google Earth on Web</strong> with 3D polygon extrusions matching neighborhood risk severity.
              </p>

              {/* Action Cards */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* Option 1: Download 3D KML */}
                <a
                  href={`/export/kml?horizon=${horizon}&region=${selectedRegion}`}
                  download={`india_risk_${selectedRegion}_h${horizon}.kml`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition group"
                >
                  <div className="p-2 rounded-md bg-blue-600 text-white shrink-0 mt-0.5">
                    <Download size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <span>Download .KML for Google Earth Pro (Desktop)</span>
                      <span className="text-[10px] bg-blue-200/70 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 px-1.5 py-0.2 rounded font-mono">
                        {horizonLabels[horizon]}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                      Includes 3D extruded pillars for {activeRegionLabel}, color-coded risk tiers, and interactive inspection balloons.
                    </p>
                  </div>
                </a>

                {/* Option 2: Open in Google Earth Web */}
                <a
                  href={`https://earth.google.com/web/@${earthCenter},35y,0h,45t,0r`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100/80 dark:hover:bg-[#142038] transition group"
                >
                  <div className="p-2 rounded-md bg-slate-700 dark:bg-slate-800 text-white shrink-0 mt-0.5">
                    <ExternalLink size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Launch Google Earth in Browser</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Opens Google Earth Web centered over {activeRegionLabel} with 3D terrain and satellite photogrammetry.
                    </p>
                  </div>
                </a>

                {/* Option 3: Switch in-app map to 3D perspective */}
                <button
                  onClick={() => {
                    toggle3D();
                    setShowEarthModal(false);
                  }}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d19] hover:bg-slate-100/80 dark:hover:bg-[#142038] transition text-left"
                >
                  <div className="p-2 rounded-md bg-indigo-600 text-white shrink-0 mt-0.5">
                    <Box size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      <span>{is3D ? 'Reset to 2D Top-Down View' : 'Toggle In-App 3D Earth Perspective'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Tilts current Google Map camera to 55° with 320° heading and satellite hybrid basemap.
                    </p>
                  </div>
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 dark:bg-[#080d19] border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Info size={13} className="text-slate-500 dark:text-slate-400" />
                  <span>How to open in Google Earth Pro (Desktop):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-600 dark:text-slate-400">
                  <li>Download the <code>.kml</code> file using the link above.</li>
                  <li>Open <strong>Google Earth Pro</strong> on your computer.</li>
                  <li>Go to <code>File &gt; Open...</code> and select the downloaded file.</li>
                  <li>Fly over India to explore 3D extruded risk polygons and click any cell for full metrics.</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setShowEarthModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md shadow-2xs hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
