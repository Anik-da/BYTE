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

    def clear_logs(self) -> bool:
        if self.db is None:
            return False
        try:
            self.db["logs"].delete_many({})
            return True
        except Exception as e:
            print(f"[MongoDB Clear Error] {e}")
            return False

    def prune_logs(self, max_keep: int = 30) -> bool:
        if self.db is None:
            return False
        try:
            count = self.db["logs"].count_documents({})
            if count > max_keep:
                to_remove_cursor = self.db["logs"].find({}, {"_id": 1}).sort("_id", 1).limit(count - max_keep)
                ids = [doc["_id"] for doc in to_remove_cursor]
                self.db["logs"].delete_many({"_id": {"$in": ids}})
            return True
        except Exception as e:
            print(f"[MongoDB Prune Error] {e}")
            return False

    def save_lifetime_fact(self, key: str, fact: str, category: str = "general") -> bool:
        if self.db is None:
            return False
        try:
            self.db["lifetime_facts"].update_one(
                {"key": key},
                {"$set": {"key": key, "fact": fact, "category": category}},
                upsert=True
            )
            return True
        except Exception as e:
            print(f"[MongoDB Fact Save Error] {e}")
            return False

    def get_lifetime_facts(self) -> List[Dict[str, Any]]:
        if self.db is None:
            return []
        try:
            cursor = self.db["lifetime_facts"].find({}, {"_id": 0})
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB Fact Read Error] {e}")
            return []

    def delete_lifetime_fact(self, key: str) -> bool:
        if self.db is None:
            return False
        try:
            res = self.db["lifetime_facts"].delete_one({"key": key})
            return res.deleted_count > 0
        except Exception as e:
            print(f"[MongoDB Fact Delete Error] {e}")
            return False

mongo_storage = MongoStorage()
