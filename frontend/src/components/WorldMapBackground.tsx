import { useEffect, useRef } from 'react';
import { fetchSystemTelemetry } from '@/lib/desktopApi';

interface LocationInfo {
  lat: number;
  lon: number;
  city: string;
  country: string;
  ip: string;
}

// Simplified world coastline outlines as polylines [lat, lon][]
// Each sub-array is one connected stroke path
const WORLD_OUTLINES: [number, number][][] = [
  // North America
  [[-10, -80], [5, -77], [10, -84], [18, -88], [20, -90], [25, -97], [30, -95], [29, -85], [25, -80], [30, -81], [35, -76], [40, -74], [42, -70], [44, -67], [47, -60], [50, -57], [52, -56], [47, -53], [60, -45], [62, -42], [67, -54], [70, -56], [73, -58], [75, -65], [72, -78], [70, -90], [72, -97], [71, -157], [65, -168], [60, -166], [59, -152], [56, -133], [50, -128], [42, -124], [35, -120], [30, -117], [25, -110], [20, -106], [18, -105], [15, -92], [10, -84]],
  // South America
  [[-5, -80], [0, -80], [5, -77], [-5, -35], [-8, -35], [-15, -39], [-23, -41], [-33, -52], [-41, -63], [-46, -67], [-52, -69], [-55, -68], [-56, -66], [-54, -65], [-52, -71], [-46, -75], [-40, -73], [-37, -73], [-33, -71], [-27, -71], [-18, -70], [-15, -76], [-5, -80]],
  // Europe
  [[36, -6], [37, -2], [40, 0], [43, 3], [44, 8], [46, 6], [47, 1], [48, -5], [49, -1], [51, 2], [53, 5], [55, 8], [57, 10], [60, 5], [62, 6], [64, 10], [67, 15], [70, 20], [71, 28], [70, 32], [67, 41], [62, 34], [56, 21], [55, 15], [54, 10], [53, 14], [50, 14], [48, 17], [46, 14], [44, 12], [42, 3], [38, -1], [36, -6]],
  // Africa
  [[36, -6], [35, -1], [34, 10], [32, 32], [30, 33], [22, 37], [15, 43], [12, 44], [5, 42], [-2, 42], [-12, 41], [-25, 35], [-34, 26], [-35, 20], [-30, 17], [-20, 13], [-13, 12], [-5, 10], [0, 10], [5, 2], [5, -5], [10, -15], [15, -17], [20, -17], [25, -15], [28, -13], [33, -8], [36, -6]],
  // Asia
  [[42, 28], [41, 45], [38, 48], [30, 48], [25, 57], [22, 60], [24, 66], [20, 73], [23, 78], [22, 88], [20, 92], [22, 97], [10, 99], [8, 98], [1, 104], [6, 118], [10, 109], [20, 110], [22, 114], [30, 121], [35, 129], [38, 135], [42, 140], [46, 143], [50, 143], [53, 141], [59, 143], [60, 160], [63, 172], [66, 180], [70, 170], [72, 140], [70, 90], [67, 41], [62, 34], [50, 30], [42, 28]],
  // Australia
  [[-25, 114], [-20, 115], [-15, 129], [-12, 132], [-12, 136], [-15, 141], [-30, 153], [-38, 146], [-38, 142], [-35, 136], [-32, 134], [-32, 128], [-25, 114]],
  // India detail
  [[30, 75], [28, 73], [25, 68], [24, 69], [21, 73], [16, 74], [12, 75], [8, 77], [10, 80], [13, 80], [17, 82], [20, 87], [22, 88], [24, 89], [26, 90], [27, 88], [26, 84], [28, 77], [30, 75]],
];

export function WorldMapBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const locationRef = useRef<LocationInfo>({
    lat: 22.5726,
    lon: 88.3639,
    city: 'Kolkata',
    country: 'India',
    ip: '127.0.0.1',
  });

  // Get actual browser Geolocation + backend data into ref
  useEffect(() => {
    let mounted = true;

    // Try browser native geolocation first (actual GPS/WiFi)
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
        () => {}, // fail silently, backend fallback will cover
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    // Also fetch from backend for city/ip data
    const fetchBackendLocation = async () => {
      const data = await fetchSystemTelemetry();
      if (data && data.location && mounted) {
        const loc = data.location;
        // Only overwrite lat/lon if browser geolocation didn't succeed
        const cur = locationRef.current;
        const hasGeo = cur.lat !== 22.5726 || cur.lon !== 88.3639;
        locationRef.current = {
          lat: hasGeo ? cur.lat : Number(loc.lat || 22.5726),
          lon: hasGeo ? cur.lon : Number(loc.lon || 88.3639),
          city: String(loc.city || 'Unknown'),
          country: String(loc.country || 'Unknown'),
          ip: String(loc.ip || '127.0.0.1'),
        };
      }
    };
    fetchBackendLocation();
    const interval = setInterval(fetchBackendLocation, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
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
      t += 0.03;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // Lat/Lon -> pixel converter
      const toXY = (lat: number, lon: number): [number, number] => {
        const x = ((lon + 180) / 360) * w;
        const y = ((90 - lat) / 180) * h;
        return [x, y];
      };

      // Draw subtle grid
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.035)';
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 80; lat += 30) {
        const [, y] = toXY(lat, 0);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let lon = -180; lon <= 180; lon += 30) {
        const [x] = toXY(0, lon);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Draw world outline strokes
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.lineWidth = 1;
      for (const outline of WORLD_OUTLINES) {
        if (outline.length < 2) continue;
        ctx.beginPath();
        const [sy, sx] = toXY(outline[0][0], outline[0][1]);
        ctx.moveTo(sy, sx);
        for (let i = 1; i < outline.length; i++) {
          const [py, px] = toXY(outline[i][0], outline[i][1]);
          ctx.lineTo(py, px);
        }
        ctx.stroke();
      }

      // Scatter dots along coastlines for density feel
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
      for (const outline of WORLD_OUTLINES) {
        for (let i = 0; i < outline.length - 1; i++) {
          const steps = 4;
          for (let s = 0; s < steps; s++) {
            const frac = s / steps;
            const mlat = outline[i][0] + (outline[i + 1][0] - outline[i][0]) * frac;
            const mlon = outline[i][1] + (outline[i + 1][1] - outline[i][1]) * frac;
            const [dx, dy] = toXY(mlat, mlon);
            ctx.beginPath();
            ctx.arc(dx, dy, 1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw user location
      const loc = locationRef.current;
      const [uX, uY] = toXY(loc.lat, loc.lon);

      // Multiple expanding pulse rings
      for (let ring = 0; ring < 3; ring++) {
        const offset = ring * 20;
        const pulseR = ((t * 18 + offset) % 50);
        const alpha = Math.max(0, 1 - pulseR / 50) * 0.35;
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(uX, uY, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Glow halo
      const pulseGlow = Math.sin(t * 2) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(239, 68, 68, ${pulseGlow * 0.2})`;
      ctx.beginPath();
      ctx.arc(uX, uY, 12, 0, Math.PI * 2);
      ctx.fill();

      // Center locator dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(uX, uY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Crosshair
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(uX - 35, uY);
      ctx.lineTo(uX + 35, uY);
      ctx.moveTo(uX, uY - 35);
      ctx.lineTo(uX, uY + 35);
      ctx.stroke();
      ctx.setLineDash([]);

      // Text label
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.fillText(`${loc.city.toUpperCase()}, ${loc.country.toUpperCase()}`, uX + 14, uY - 8);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.font = '8px "Share Tech Mono", monospace';
      ctx.fillText(`${loc.lat.toFixed(4)}° N  ${loc.lon.toFixed(4)}° E`, uX + 14, uY + 4);
      ctx.fillText(`IP: ${loc.ip}`, uX + 14, uY + 14);

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []); // empty deps = never restarts

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full opacity-70" />;
}
