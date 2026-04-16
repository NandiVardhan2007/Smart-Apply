import psutil
import logging
import os

logger = logging.getLogger(__name__)

def log_resource_usage(context: str = "General"):
    """Logs the current memory and CPU usage of the process."""
    try:
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        rss_mb = mem_info.rss / (1024 * 1024)
        vms_mb = mem_info.vms / (1024 * 1024)
        cpu_percent = process.cpu_percent(interval=None)
        
        logger.info(f"[Monitoring] [{context}] RAM: {rss_mb:.2f}MB (RSS), {vms_mb:.2f}MB (VMS) | CPU: {cpu_percent}%")
        
        # Alert if memory is high (Render free tier is usually 512MB)
        if rss_mb > 400:
            logger.warning(f"[Monitoring] ⚠️ HIGH MEMORY USAGE detected: {rss_mb:.2f}MB. Approaching Render 512MB limit!")
            
    except Exception as e:
        logger.debug(f"[Monitoring] Could not log resource usage: {e}")

def get_memory_usage_mb() -> float:
    """Returns the current RSS memory usage in MB."""
    try:
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0
