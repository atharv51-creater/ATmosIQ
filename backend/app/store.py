"""File-backed data store. Re-reads a file automatically when it changes on disk, so you can drop in new
pipeline output without restarting the server."""
import json
import threading
from pathlib import Path


class DataNotReady(Exception):
    pass


class DataStore:
    def __init__(self, data_dir):
        self.dir = Path(data_dir)
        self._cache, self._lock = {}, threading.Lock()

    def get(self, name):
        path = self.dir / name
        if not path.exists():
            raise DataNotReady(f"{name} not found in {self.dir}. Copy the ML pipeline's output/ files here.")
        mtime = path.stat().st_mtime
        with self._lock:
            hit = self._cache.get(name)
            if hit and hit[0] == mtime:
                return hit[1]
            with open(path) as f:
                obj = json.load(f)
            self._cache[name] = (mtime, obj)
            return obj

    def exists(self, name):
        return (self.dir / name).exists()

    @property
    def is_synthetic(self):
        return (self.dir / "_SYNTHETIC.txt").exists()
