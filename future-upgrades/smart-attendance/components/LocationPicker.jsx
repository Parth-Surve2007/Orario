import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 19.045701, lng: 72.889137 };

const markerIcon = L.divIcon({
  className: '',
  html: '<div class="w-5 h-5 bg-primary border-4 border-outline shadow-[2px_2px_0px_var(--color-outline)]"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function LocationPicker({ value, onSave }) {
  const mapRef = useRef(null);
  const mapNodeRef = useRef(null);
  const markerRef = useRef(null);
  const [selected, setSelected] = useState(value?.lat && value?.lng ? value : DEFAULT_CENTER);
  const [query, setQuery] = useState('VESIT Mumbai');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return undefined;

    const map = L.map(mapNodeRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([selected.lat, selected.lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker([selected.lat, selected.lng], { icon: markerIcon }).addTo(map);

    map.on('click', (event) => {
      const next = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      };
      setSelected(next);
      marker.setLatLng([next.lat, next.lng]);
    });

    mapRef.current = map;
    markerRef.current = marker;

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;

    markerRef.current.setLatLng([selected.lat, selected.lng]);
    mapRef.current.setView([selected.lat, selected.lng], Math.max(mapRef.current.getZoom(), 16));
  }, [selected]);

  const searchPlaces = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        limit: '5',
        addressdetails: '1',
        q: trimmed,
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data);
      if (data.length === 0) setError('No places found. Try a more specific search.');
    } catch (searchError) {
      console.error(searchError);
      setError('Could not search places right now. Check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const chooseResult = (result) => {
    const next = {
      lat: Number(parseFloat(result.lat).toFixed(6)),
      lng: Number(parseFloat(result.lon).toFixed(6)),
    };
    setSelected(next);
    setResults([]);
    setQuery(result.display_name.split(',').slice(0, 2).join(', '));
  };

  return (
    <div className="flex flex-col gap-3 border-2 border-outline p-3 bg-surface-container shadow-[2px_2px_0px_var(--color-outline)]">
      <div className="flex flex-col gap-2">
        <label className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Search place</label>
        <div className="flex gap-2">
          <input
            type="search"
            className="voxel-input min-w-0 flex-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                searchPlaces();
              }
            }}
            placeholder="Search college or landmark"
          />
          <button className="voxel-btn-secondary text-label-sm shrink-0" onClick={searchPlaces} disabled={isSearching}>
            {isSearching ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {error && <p className="text-[10px] text-error font-bold">{error}</p>}

      {results.length > 0 && (
        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
          {results.map((result) => (
            <button
              key={`${result.place_id}-${result.lat}-${result.lon}`}
              className="border-2 border-outline bg-surface-container-lowest p-2 text-left shadow-[2px_2px_0px_var(--color-outline)]"
              onClick={() => chooseResult(result)}
            >
              <span className="text-label-sm font-bold text-on-surface block leading-4">{result.name || result.display_name.split(',')[0]}</span>
              <span className="text-[10px] text-on-surface-variant block leading-4">{result.display_name}</span>
            </button>
          ))}
        </div>
      )}

      <div
        ref={mapNodeRef}
        className="h-64 w-full border-2 border-outline bg-surface-container-lowest shadow-[2px_2px_0px_var(--color-outline)] overflow-hidden"
        aria-label="College location map picker"
      />

      <p className="text-[10px] text-on-surface-variant leading-4">
        Search for a place, choose a result, or tap the map to move the marker.
      </p>

      <div className="border-2 border-outline bg-surface-container-lowest p-2 text-center font-mono text-xs text-on-surface">
        {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
      </div>

      <button className="voxel-btn-primary flex items-center justify-center gap-2" onClick={() => onSave(selected)}>
        Save College Location
      </button>
    </div>
  );
}
