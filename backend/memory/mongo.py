import os
import pymongo
from typing import Dict, Any, List

MONGO_URI = "mongodb+srv://anikda9945_db_user:vFXtQ79Ws5bvtHCj@cluster0.rnjbssz.mongodb.net/?retryWrites=true&w=majority"

class MongoStorage:
    def __init__(self):
        self.client = None
        self.db = None
        try:
            self.client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            self.db = self.client["byte_db"]
        except Exception as e:
            print(f"[MongoDB Warning] Could not initialize client: {e}")

    def save_log(self, role: str, content: str, intent: str = None) -> bool:
        if self.db is None:
            return False
        try:
            self.db["logs"].insert_one({
                "role": role,
                "content": content,
                "intent": intent
            })
            return True
        except Exception as e:
            print(f"[MongoDB Log Error] {e}")
            return False

    def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        if self.db is None:
            return []
        try:
            cursor = self.db["logs"].find({}, {"_id": 0}).sort("_id", -1).limit(limit)
            return list(reversed(list(cursor)))
        except Exception as e:
            print(f"[MongoDB Read Error] {e}")
            return []

mongo_storage = MongoStorage()
