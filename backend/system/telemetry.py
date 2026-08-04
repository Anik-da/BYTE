import subprocess
import psutil
from typing import Dict, Any

class SystemTelemetry:
    """
    Hardware and OS Telemetry Engine for Windows 11.
    Monitors CPU load, Virtual Memory, active processes, and NVIDIA GPU metrics.
    """
    def __init__(self):
        pass

    def get_metrics(self) -> Dict[str, Any]:
        cpu_load = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        battery = psutil.sensors_battery()
        
        gpu_info = {
            "gpu_name": "NVIDIA GeForce RTX 4060",
            "gpu_percent": 0,
            "vram_used_mb": 0,
            "vram_total_mb": 8188,
            "vram_percent": 0,
            "cuda_available": True
        }
        
        try:
            cmd = "nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits"
            out = subprocess.check_output(cmd, shell=True, text=True, timeout=2).strip()
            if out:
                parts = [p.strip() for p in out.split(',')]
                if len(parts) >= 4:
                    gpu_info["gpu_name"] = parts[0]
                    used = float(parts[1])
                    total = float(parts[2])
                    gpu_info["vram_used_mb"] = round(used, 1)
                    gpu_info["vram_total_mb"] = round(total, 1)
                    gpu_info["vram_percent"] = round((used / total) * 100, 1) if total > 0 else 0
                    gpu_info["gpu_percent"] = int(parts[3])
        except Exception:
            pass

        return {
            "status": "online",
            "cpu_load": cpu_load,
            "memory_used_mb": round(mem.used / (1024 * 1024), 1),
            "memory_percent": mem.percent,
            "battery_percent": battery.percent if battery else 100,
            "battery_plugged": battery.power_plugged if battery else True,
            "processes_count": len(psutil.pids()),
            "gpu": gpu_info
        }

system_telemetry = SystemTelemetry()
