import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { CivicIssueReport } from '../types';
import { Loader2, Layers } from 'lucide-react';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

const MAPS_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(MAPS_API_KEY) && MAPS_API_KEY !== 'YOUR_MAPS_KEY';

function HeatmapOverlayComponent({ reports }: { reports: CivicIssueReport[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const overlay = new GoogleMapsOverlay({
      layers: [
        new HeatmapLayer({
          id: 'heatmap-layer',
          data: reports,
          getPosition: (d: CivicIssueReport) => [d.location.lng, d.location.lat],
          getWeight: 1,
          radiusPixels: 40,
        })
      ]
    });
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [map, reports]);
  return null;
}

function MarkerWithInfoWindow({ report, onClick }: { report: CivicIssueReport, onClick: () => void, key?: React.Key }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);
  const map = useMap();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return '#dc2626'; // red-600
      case 'High': return '#ea580c'; // orange-600
      case 'Medium': return '#eab308'; // yellow-500
      default: return '#22c55e'; // green-500
    }
  };

  const handleMarkerClick = () => {
    setOpen(true);
    if (map) {
      map.panTo(report.location);
    }
  };

  return (
    <>
      <AdvancedMarker 
        ref={markerRef} 
        position={report.location} 
        onClick={handleMarkerClick}
      >
        <Pin background={getSeverityColor(report.severity)} glyphColor="#fff" borderColor="transparent" />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)} maxWidth={250}>
          <div className="p-1 cursor-pointer font-sans" onClick={onClick}>
            <div className="flex justify-between items-start mb-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                report.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                report.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                report.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {report.severity}
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-800 leading-tight mb-1">{report.category}</h3>
            <p className="text-[10px] text-slate-500 mb-2 truncate">{report.description}</p>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:text-blue-700">View Details &rarr;</p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function fitMapToIndia(map: google.maps.Map) {
  if (!window.google || !window.google.maps) return;
  const indiaBounds = new window.google.maps.LatLngBounds(
    new window.google.maps.LatLng(6.5, 68.0),
    new window.google.maps.LatLng(35.5, 97.5)
  );

  map.fitBounds(indiaBounds, 0);
}

function TopLeftControls() {
  const map = useMap();
  const [mapType, setMapType] = useState('roadmap');
  
  const toggleMapType = () => {
    if (map) {
      const nextType = mapType === 'roadmap' ? 'hybrid' : 'roadmap';
      map.setMapTypeId(nextType);
      setMapType(nextType);
    }
  };

  return (
    <div className="absolute top-[10px] left-[10px] flex flex-col gap-[10px] z-10">
      <button onClick={toggleMapType} className="bg-white border border-[#e0e0e0] rounded-[8px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] text-[13px] font-medium py-[8px] px-[14px] min-w-[120px] text-[#333333] hover:bg-[#f5f5f5] transition-colors flex items-center justify-center">
        {mapType === 'roadmap' ? 'Satellite View' : 'Map View'}
      </button>
      
      <button
        onClick={() => {
          if (map) {
            fitMapToIndia(map);
          }
        }}
        className="bg-white border border-[#e0e0e0] rounded-[8px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] text-[13px] font-medium py-[8px] px-[14px] min-w-[120px] text-[#333333] hover:bg-[#f5f5f5] transition-colors flex items-center justify-center"
      >
        Reset View
      </button>
    </div>
  );
}

function MapInitializer({ locationState }: { locationState?: { center?: { lat: number, lng: number }, zoom?: number } }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    if (locationState?.center) {
      map.panTo(locationState.center);
      if (locationState.zoom) {
        map.setZoom(locationState.zoom);
      }
    } else {
      if (window.google && window.google.maps) {
        window.google.maps.event.addListenerOnce(map, 'idle', () => {
          fitMapToIndia(map);
        });
      }
      fitMapToIndia(map);
    }

    const handleResize = () => {
      if (!locationState?.center) {
        fitMapToIndia(map);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map, locationState]);
  
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = state as { center?: { lat: number, lng: number }, zoom?: number } | undefined;

  const [reports, setReports] = useState<CivicIssueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    async function fetchReports() {
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(reportsRef);
        const querySnapshot = await getDocs(q);
        const fetchedReports: CivicIssueReport[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as CivicIssueReport;
          if (data.location && typeof data.location.lat === 'number') {
             fetchedReports.push({ id: doc.id, ...data });
          }
        });
        setReports(fetchedReports);
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  if (!hasValidKey) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-200 p-8 text-center z-0" style={{ backgroundImage: 'radial-gradient(#d1d1d1 1.5px, transparent 0)', backgroundSize: '24px 24px' }}>
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Google Maps API Key Required</h2>
          <p className="text-slate-600 max-w-md mb-6 text-sm">
            To view the civic issues map, please configure your Google Maps Platform API key in the AI Studio Secrets panel.
          </p>
          <div className="bg-slate-50 p-4 rounded-xl text-left max-w-md w-full text-sm border border-slate-100">
            <p className="font-bold text-xs uppercase text-slate-400 tracking-widest mb-2">Instructions</p>
            <ol className="list-decimal pl-5 space-y-2 text-slate-700 font-medium">
              <li>Open Settings (⚙️ icon, top-right)</li>
              <li>Select Secrets</li>
              <li>Add <code className="bg-slate-200 px-1 py-0.5 rounded text-xs font-bold">GOOGLE_MAPS_PLATFORM_KEY</code></li>
              <li>Paste your key and press Enter</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 flex justify-center items-center bg-slate-200 z-0" style={{ backgroundImage: 'radial-gradient(#d1d1d1 1.5px, transparent 0)', backgroundSize: '24px 24px' }}>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-200 z-0">
      <APIProvider apiKey={MAPS_API_KEY} version="weekly">
        <MapInitializer locationState={locationState} />
        <TopLeftControls />
        <GoogleMap
          mapId="CIVIC_CONNECT_MAP_ID"
          defaultCenter={{ lat: 22.5, lng: 82.0 }}
          defaultZoom={5}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={true}
          zoomControl={true}
        >
          {showHeatmap ? (
            <HeatmapOverlayComponent reports={reports} />
          ) : (
            reports.map((report) => (
              <MarkerWithInfoWindow 
                key={report.id} 
                report={report} 
                onClick={() => navigate(`/issue/${report.id}`)}
              />
            ))
          )}
        </GoogleMap>
      </APIProvider>
      
      {/* Controls */}
      <div className="absolute top-[10px] right-[10px] flex flex-col gap-[10px] z-10">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`bg-white border border-[#e0e0e0] rounded-[8px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] text-[13px] font-medium py-[8px] px-[14px] min-w-[120px] text-[#333333] hover:bg-[#f5f5f5] transition-colors flex items-center justify-center gap-2 ${
            showHeatmap ? 'bg-[#f5f5f5]' : ''
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{showHeatmap ? 'Heatmap On' : 'Heatmap Off'}</span>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-[10px] left-[10px] bg-white border border-[#e0e0e0] rounded-[8px] shadow-[0_2px_6px_rgba(0,0,0,0.15)] p-[12px] z-10 min-w-[120px]">
        <h4 className="text-[11px] font-medium uppercase text-gray-500 mb-2">Severity</h4>
        <div className="space-y-1" style={{ lineHeight: 1.8 }}>
          <div className="flex items-center"><div className="w-[10px] h-[10px] rounded-full bg-[#dc2626] mr-2"></div><span className="text-[13px] font-medium text-[#333333]">Critical</span></div>
          <div className="flex items-center"><div className="w-[10px] h-[10px] rounded-full bg-[#ea580c] mr-2"></div><span className="text-[13px] font-medium text-[#333333]">High</span></div>
          <div className="flex items-center"><div className="w-[10px] h-[10px] rounded-full bg-[#eab308] mr-2"></div><span className="text-[13px] font-medium text-[#333333]">Medium</span></div>
          <div className="flex items-center"><div className="w-[10px] h-[10px] rounded-full bg-[#22c55e] mr-2"></div><span className="text-[13px] font-medium text-[#333333]">Low</span></div>
        </div>
      </div>
    </div>
  );
}
