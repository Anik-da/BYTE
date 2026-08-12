import { useEffect, useRef, useState } from 'react';
import { fetchSystemTelemetry } from '@/lib/desktopApi';
import worldMapUrl from '../assets/world-map.svg';

interface LocationInfo {
  lat: number;
  lon: number;
  city: string;
  country: string;
  ip: string;
}

interface ConnectionDot {
  ip: string;
  port: number;
  angle: number;
  distance: number;
  status: string;
}

// Major global cities for animated data flow arcs
const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Frankfurt', lat: 50.11, lon: 8.68 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'Moscow', lat: 55.76, lon: 37.62 },
];

// Offline fallback outline points
const WORLD_FALLBACK: [number, number][][] = [
  [[60,-140],[65,-168],[71,-157],[72,-97],[75,-65],[73,-58],[70,-56],[67,-54],[62,-42],[60,-45],[47,-53],[52,-56],[50,-57],[47,-60],[44,-67],[42,-70],[40,-74],[35,-76],[30,-81],[25,-80],[29,-85],[30,-95],[25,-97],[20,-90],[18,-88],[10,-84],[5,-77],[-5,-80]],
  [[10,-76],[8,-72],[12,-72],[5,-60],[0,-50],[-5,-35],[-8,-35],[-15,-39],[-23,-41],[-33,-52],[-41,-63],[-46,-67],[-52,-69],[-55,-68],[-56,-66],[-54,-65],[-52,-71],[-46,-75],[-40,-73],[-33,-71],[-27,-71],[-18,-70],[-15,-76],[-5,-80],[5,-77],[10,-76]],
  [[36,-6],[37,-2],[40,0],[43,3],[44,8],[46,6],[47,1],[48,-5],[49,-1],[51,2],[53,5],[55,8],[57,10],[60,5],[62,6],[64,10],[67,15],[70,20],[71,28]],
  [[71,28],[70,32],[67,41],[62,34],[56,21],[55,15],[54,10],[53,14],[50,14],[48,17],[46,14],[44,12],[42,3],[38,-1],[36,-6]],
  [[36,-6],[35,-1],[34,10],[32,32],[30,33],[22,37],[15,43],[12,44],[5,42],[-2,42],[-12,41],[-25,35],[-34,26],[-35,20],[-30,17],[-20,13],[-13,12],[-5,10],[0,10],[5,2],[5,-5],[10,-15],[15,-17],[20,-17],[25,-15],[28,-13],[33,-8],[36,-6]],
  [[42,28],[41,45],[38,48],[30,48],[25,57],[22,60],[24,66],[20,73]],
  [[30,75],[28,73],[25,68],[24,69],[21,73],[16,74],[12,75],[8,77],[10,80],[13,80],[17,82],[20,87],[22,88]],
  [[22,88],[20,92],[22,97],[10,99],[8,98],[1,104],[6,118],[10,109],[20,110],[22,114],[30,121],[35,129],[38,135],[42,140],[46,143],[50,143],[53,141],[59,143],[60,160],[63,172]],
  [[71,28],[72,50],[72,90],[72,140],[70,170],[66,180]],
  [[-25,114],[-20,115],[-15,129],[-12,132],[-12,136],[-15,141],[-30,153],[-38,146],[-38,142],[-35,136],[-32,134],[-32,128],[-25,114]],
];

export function WorldMapBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const locationRef = useRef<LocationInfo>({
    lat: 22.5726, lon: 88.3639,
    city: 'Kolkata', country: 'India', ip: '127.0.0.1',
  });
  const connectionsRef = useRef<ConnectionDot[]>([]);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load realistic high-definition SVG world map from local package
  useEffect(() => {
    const img = new Image();
    img.src = worldMapUrl;
    img.onload = () => {
      mapImageRef.current = img;
      setMapLoaded(true);
    };
  }, []);

  // Poll geolocation and connections into refs
  useEffect(() => {
    let mounted = true;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (mounted) {
            locationRef.current = {
              ...locationRef.current,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            };
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    const fetchData = async () => {
      const data = await fetchSystemTelemetry();
      if (!data || !mounted) return;
      if (data.location) {
        const cur = locationRef.current;
        const hasGeo = cur.lat !== 22.5726 || cur.lon !== 88.3639;
        locationRef.current = {
          lat: hasGeo ? cur.lat : Number(data.location.lat || 22.5726),
          lon: hasGeo ? cur.lon : Number(data.location.lon || 88.3639),
          city: String(data.location.city || 'Unknown'),
          country: String(data.location.country || 'Unknown'),
          ip: String(data.location.ip || '127.0.0.1'),
        };
      }
      if (data.connections) {
        connectionsRef.current = data.connections;
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Single persistent animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      t += 0.008;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // standard Equirectangular projection mapping calibrated for simple-world-map viewBox
      const toXY = (lat: number, lon: number): [number, number] => {
        const svgX = 2.1755 * lon + 423.22;
        const svgY = -3.031 * lat + 532.4;
        
        const canvasX = ((svgX - 30.767) / 784.077) * w;
        const canvasY = ((svgY - 241.591) / 458.627) * h;
        
        return [canvasX, canvasY];
      };

      // --- Animated scanning grid ---
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.025)';
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 80; lat += 15) {
        const [, y] = toXY(lat, 0);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let lon = -180; lon <= 180; lon += 15) {
        const [x] = toXY(0, lon);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      // Horizontal scan line animation
      const scanY = (t * 120) % h;
      const scanGrad = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
      scanGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      scanGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.08)');
      scanGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 3, w, 6);

      // --- Draw Realistic High-Definition World Map ---
      if (mapImageRef.current) {
        ctx.save();
        // Set slightly higher opacity for better visibility
        ctx.globalAlpha = 0.35;
        ctx.drawImage(mapImageRef.current, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = 'rgb(239, 68, 68)';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      } else {
        // Offline / loading fallback: procedurally draw continents
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
        ctx.lineWidth = 0.8;
        for (const outline of WORLD_FALLBACK) {
          if (outline.length < 2) continue;
          ctx.beginPath();
          const [sx, sy] = toXY(outline[0][0], outline[0][1]);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < outline.length; i++) {
            const [px, py] = toXY(outline[i][0], outline[i][1]);
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }

      // --- City nodes ---
      const loc = locationRef.current;
      const [uX, uY] = toXY(loc.lat, loc.lon);

      for (const city of CITIES) {
        const [cx, cy] = toXY(city.lat, city.lon);
        const pulse = Math.sin(t * 3 + city.lat * 0.1) * 0.3 + 0.7;

        // City dot
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.7})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // --- Animated data flow arc from user location to city ---
        const dx = cx - uX;
        const dy = cy - uY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 10) continue;

        // Draw curved arc
        const midX = (uX + cx) / 2;
        const midY = (uY + cy) / 2 - dist * 0.12; // curve upward
        ctx.strokeStyle = `rgba(239, 68, 68, 0.06)`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(uX, uY);
        ctx.quadraticCurveTo(midX, midY, cx, cy);
        ctx.stroke();

        // Animated data packet traveling along the arc
        const speed = 0.3 + (city.lon % 7) * 0.05;
        const progress = ((t * speed + city.lat * 0.01) % 1);
        const inv = 1 - progress;
        const packetX = inv * inv * uX + 2 * inv * progress * midX + progress * progress * cx;
        const packetY = inv * inv * uY + 2 * inv * progress * midY + progress * progress * cy;

        ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + Math.sin(t * 5) * 0.3})`;
        ctx.beginPath();
        ctx.arc(packetX, packetY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- User location marker ---
      // Multiple expanding pulse rings
      for (let ring = 0; ring < 3; ring++) {
        const offset = ring * 18;
        const pulseR = ((t * 25 + offset) % 45);
        const alpha = Math.max(0, 1 - pulseR / 45) * 0.3;
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(uX, uY, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Glow halo
      const haloGrad = ctx.createRadialGradient(uX, uY, 0, uX, uY, 20);
      haloGrad.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
      haloGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(uX, uY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Center dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(uX, uY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Rotating targeting brackets
      ctx.save();
      ctx.translate(uX, uY);
      ctx.rotate(t * 0.5);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      const bSize = 12;
      ctx.beginPath(); ctx.moveTo(-bSize, -bSize + 4); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize + 4, -bSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bSize - 4, -bSize); ctx.lineTo(bSize, -bSize); ctx.lineTo(bSize, -bSize + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bSize, bSize - 4); ctx.lineTo(bSize, bSize); ctx.lineTo(bSize - 4, bSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-bSize + 4, bSize); ctx.lineTo(-bSize, bSize); ctx.lineTo(-bSize, bSize - 4); ctx.stroke();
      ctx.restore();

      // Dashed crosshair
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(uX - 30, uY); ctx.lineTo(uX + 30, uY);
      ctx.moveTo(uX, uY - 30); ctx.lineTo(uX, uY + 30);
      ctx.stroke();
      ctx.setLineDash([]);

      // Location text label
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.fillText(`${loc.city.toUpperCase()}, ${loc.country.toUpperCase()}`, uX + 18, uY - 10);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.fillText(`${loc.lat.toFixed(4)}°N  ${loc.lon.toFixed(4)}°E`, uX + 18, uY + 2);
      ctx.fillText(`IP: ${loc.ip}`, uX + 18, uY + 12);

      // Connection count badge
      const connCount = connectionsRef.current.length;
      if (connCount > 0) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.font = '8px "Share Tech Mono", monospace';
        ctx.fillText(`${connCount} ACTIVE CONNECTIONS`, uX + 18, uY + 22);
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [mapLoaded]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full opacity-80" />;
}
