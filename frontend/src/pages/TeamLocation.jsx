import React, { useEffect, useRef, useState } from "react";
import { MapPin, RefreshCw, Clock } from "lucide-react";
import { api } from "../lib/api";

function timeAgo(isoString) {
  if (!isoString) return "Tidak diketahui";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

const COLORS = ["#7C3AED", "#059669", "#DC2626", "#D97706", "#2563EB", "#DB2777"];

export default function TeamLocation() {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/location/team");
      setMembers(res.data);
      setLastRefresh(new Date());
    } catch (e) {
      setError("Gagal memuat lokasi tim");
    } finally {
      setLoading(false);
    }
  };

  // Init Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current).setView([-6.2, 106.8], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      leafletMap.current = map;
    });
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Update markers when members change
  useEffect(() => {
    if (!leafletMap.current || !members.length) return;
    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = [];
      members.forEach((member, i) => {
        const color = COLORS[i % COLORS.length];
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:13px;font-weight:bold;">${member.full_name.charAt(0).toUpperCase()}</span>
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([member.lat, member.lng], { icon })
          .addTo(leafletMap.current)
          .bindPopup(`<b>${member.full_name}</b><br>@${member.username}<br><small>${timeAgo(member.updated_at)}</small>`);

        markersRef.current.push(marker);
        bounds.push([member.lat, member.lng]);
      });

      if (bounds.length > 0) {
        leafletMap.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    });
  }, [members]);

  useEffect(() => {
    loadLocations();
    const interval = setInterval(loadLocations, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Lokasi Tim</h1>
          {lastRefresh && (
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              Update {timeAgo(lastRefresh.toISOString())}
            </p>
          )}
        </div>
        <button
          onClick={loadLocations}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden shadow-md flex-1 min-h-64">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <div ref={mapRef} className="w-full h-full min-h-64" />
        {loading && members.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* Member list */}
      {members.length === 0 && !loading ? (
        <div className="text-center text-slate-400 text-sm py-4">
          Belum ada anggota tim yang berbagi lokasi.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m, i) => (
            <div
              key={m.username}
              className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm p-3 border border-slate-100 dark:border-slate-700"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              >
                {m.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{m.full_name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(m.updated_at)}
                </p>
              </div>
              <MapPin className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
