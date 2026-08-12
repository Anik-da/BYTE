import { useEffect, useRef, useState } from 'react';
import { fetchSystemTelemetry } from '@/lib/desktopApi';

interface LocationInfo {
  lat: number;
  lon: number;
  city: string;
  country: string;
  ip: string;
}

export function WorldMapBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [location, setLocation] = useState<LocationInfo>({
    lat: 22.5726,
    lon: 88.3639,
    city: 'Kolkata',
    country: 'India',
    ip: '127.0.0.1',
  });

  useEffect(() => {
    let mounted = true;
    const updateLocation = async () => {
      const data = await fetchSystemTelemetry();
      if (data && data.location && mounted) {
        setLocation({
          lat: Number(data.location.lat || 22.5726),
          lon: Number(data.location.lon || 88.3639),
          city: String(data.location.city || 'Kolkata'),
          country: String(data.location.country || 'India'),
          ip: String(data.location.ip || '127.0.0.1'),
        });
      }
    };
    updateLocation();
    const interval = setInterval(updateLocation, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

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
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Simple tactical world representation points (latitude, longitude)
    // Structured to outline key continents
    const continentPoints: [number, number][] = [];
    
    // North America
    for (let lat = 25; lat < 70; lat += 4) {
      for (let lon = -125; lon < -60; lon += 5) {
        if (lat > 50 && lon < -100) continentPoints.push([lat, lon]);
        else if (lat < 50 && lon > -100) continentPoints.push([lat, lon]);
      }
    }
    // South America
    for (let lat = -55; lat < 10; lat += 4) {
      for (let lon = -75; lon < -35; lon += 5) {
        if (lat > -20 || (lat <= -20 && lon < -50)) {
          continentPoints.push([lat, lon]);
        }
      }
    }
    // Eurasia & Africa
    for (let lat = 10; lat < 75; lat += 4) {
      for (let lon = -10; lon < 140; lon += 5) {
        if (lat > 35 || (lat <= 35 && lon > 15 && lon < 60)) {
          continentPoints.push([lat, lon]);
        }
      }
    }
    // Africa
    for (let lat = -35; lat < 30; lat += 4) {
      for (let lon = -15; lon < 50; lon += 5) {
        if (lat < 10 && lon < 40) continentPoints.push([lat, lon]);
      }
    }
    // Australia
    for (let lat = -40; lat < -12; lat += 4) {
      for (let lon = 113; lon < 153; lon += 5) {
        continentPoints.push([lat, lon]);
      }
    }
    // Greenland
    for (let lat = 60; lat < 83; lat += 4) {
      for (let lon = -60; lon < -20; lon += 6) {
        continentPoints.push([lat, lon]);
      }
    }

    const draw = () => {
      t += 0.05;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      // Draw Grid lines
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.02)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Projection converter
      const getCoords = (lat: number, lon: number): [number, number] => {
        const x = ((lon + 180) / 360) * w;
        // Mercator-ish projection layout
        const y = h/2 - (lat * (h / 180));
        return [x, y];
      };

      // Draw World continents dots
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      for (const pt of continentPoints) {
        const [x, y] = getCoords(pt[0], pt[1]);
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw User Live Location
      const [uX, uY] = getCoords(location.lat, location.lon);

      // Radar-like sweeping rings around current location
      const pulseRadius = (t * 22) % 60;
      ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 1 - pulseRadius / 60) * 0.45})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(uX, uY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Pulsing outer dot
      const pulseGlow = Math.sin(t * 1.5) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(239, 68, 68, ${pulseGlow * 0.45})`;
      ctx.beginPath();
      ctx.arc(uX, uY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Core center locator dot
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(uX, uY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal & vertical targeting scanner lines
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.lineWidth = 1;
      
      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(uX - 45, uY);
      ctx.lineTo(uX + 45, uY);
      ctx.stroke();

      // Vertical crosshair
      ctx.beginPath();
      ctx.moveTo(uX, uY - 45);
      ctx.lineTo(uX, uY + 45);
      ctx.stroke();

      // Location HUD Data text next to node
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.fillText(`${location.city.toUpperCase()}, ${location.country.toUpperCase()}`, uX + 12, uY - 6);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.fillText(`LAT: ${location.lat.toFixed(4)}° / LON: ${location.lon.toFixed(4)}°`, uX + 12, uY + 6);
      ctx.fillText(`IP: ${location.ip}`, uX + 12, uY + 16);

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, [location]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full opacity-40" />;
}
