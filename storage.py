import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import threading

class SimpleStorage:
    def __init__(self, filename="storage/data.json"):
        self.filename = filename
        self.lock = threading.Lock()
        self.data = self.load()
    
    def load(self):
        """Load data from JSON file"""
        if os.path.exists(self.filename):
            try:
                with open(self.filename, 'r') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                print(f"⚠️ Corrupted data file, creating new one")
                return self._empty_data()
        return self._empty_data()
    
    def _empty_data(self):
        """Create empty data structure"""
        return {
            "detections": [],
            "users": [],
            "settings": {
                "model_version": "room_objects:v2",
                "confidence_threshold": 0.5,
                "created_at": datetime.now().isoformat()
            }
        }
    
    def save(self):
        """Save data to JSON file with thread safety"""
        with self.lock:
            os.makedirs(os.path.dirname(self.filename), exist_ok=True)
            with open(self.filename, 'w') as f:
                json.dump(self.data, f, indent=2, default=str)
    
    def add_detection(self, detection: Dict[str, Any]):
        """Add a detection record"""
        detection['timestamp'] = datetime.now().isoformat()
        detection['id'] = len(self.data['detections']) + 1
        self.data['detections'].append(detection)
        self.save()
        return detection['id']
    
    def get_detections(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get recent detections"""
        return self.data['detections'][-limit-offset:len(self.data['detections'])-offset] if offset > 0 else self.data['detections'][-limit:]
    
    def get_all_detections(self) -> List[Dict]:
        """Get all detections"""
        return self.data['detections']
    
    def get_detection_by_id(self, detection_id: int) -> Optional[Dict]:
        """Get detection by ID"""
        for det in self.data['detections']:
            if det.get('id') == detection_id:
                return det
        return None
    
    def clear_detections(self):
        """Clear all detections"""
        self.data['detections'] = []
        self.save()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get detection statistics"""
        detections = self.data['detections']
        if not detections:
            return {
                "total_detections": 0,
                "total_objects": 0,
                "class_counts": {},
                "last_detection": None,
                "first_detection": None,
            }
        
        class_counts = {}
        for det in detections:
            for obj in det.get('objects', []):
                class_name = obj.get('class', 'unknown')
                class_counts[class_name] = class_counts.get(class_name, 0) + 1
        
        return {
            "total_detections": len(detections),
            "total_objects": sum(class_counts.values()),
            "class_counts": class_counts,
            "last_detection": detections[-1].get('timestamp') if detections else None,
            "first_detection": detections[0].get('timestamp') if detections else None
        }
    
    def add_user(self, username: str, api_key: str = None):
        """Add a user"""
        user = {
            "id": len(self.data['users']) + 1,
            "username": username,
            "api_key": api_key,
            "created_at": datetime.now().isoformat(),
            "last_login": None
        }
        self.data['users'].append(user)
        self.save()
        return user
    
    def get_users(self) -> List[Dict]:
        """Get all users"""
        return self.data['users']
    
    def export_data(self, filename: str = "export.json"):
        """Export all data to a file"""
        with open(filename, 'w') as f:
            json.dump(self.data, f, indent=2, default=str)
        return filename
    
    def import_data(self, filename: str):
        """Import data from a file"""
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                self.data = json.load(f)
            self.save()
            return True
        return False

# Create singleton instance
storage = SimpleStorage()
