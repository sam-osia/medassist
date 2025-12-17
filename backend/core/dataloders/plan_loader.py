import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
import datetime

logger = logging.getLogger(__name__)

# Configuration
PLANS_DIR = "plans"

class PlanCache:
    """Thread-safe singleton cache for plan data."""
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        with self._lock:
            if not self._initialized:
                self._plans_cache = None
                self._initialized = True
    
    def get_plans_cache(self) -> Dict[str, Any]:
        """Get cached plans, loading them if necessary."""
        if self._plans_cache is None:
            with self._lock:
                if self._plans_cache is None:  # Double-check lock pattern
                    self._plans_cache = self._load_all_plans()
        return self._plans_cache
    
    def invalidate(self):
        """Clear the cached plans."""
        with self._lock:
            self._plans_cache = None
    
    def _load_all_plans(self) -> Dict[str, Any]:
        """Load all plans from disk."""
        logger.info("Loading plans from disk...")
        
        plans = {}
        
        if not os.path.exists(PLANS_DIR):
            os.makedirs(PLANS_DIR, exist_ok=True)
            logger.info(f"Created plans directory: {PLANS_DIR}")
            return plans
        
        for filename in os.listdir(PLANS_DIR):
            if not filename.endswith('.json'):
                continue
                
            plan_name = filename[:-5]  # Remove .json extension
            plan_path = os.path.join(PLANS_DIR, filename)
            
            try:
                with open(plan_path, 'r') as f:
                    plan_data = json.load(f)
                
                # Validate required fields
                required_fields = ['plan_name', 'created_date', 'conversation_history', 'raw_plan']
                if all(field in plan_data for field in required_fields):
                    plans[plan_name] = plan_data
                else:
                    logger.warning(f"Plan {plan_name} missing required fields, skipping")
                    
            except Exception as e:
                logger.error(f"Error loading plan {plan_name}: {e}")
                continue
        
        logger.info(f"Loaded {len(plans)} plans from disk")
        return plans
    
    def save_plan(self, plan_name: str, plan_data: Dict[str, Any]) -> bool:
        """Save a plan to disk and update cache."""
        try:
            # Ensure plans directory exists
            os.makedirs(PLANS_DIR, exist_ok=True)
            
            # Add timestamps
            current_time = datetime.datetime.now().isoformat()
            plan_data['plan_name'] = plan_name
            plan_data['last_modified_date'] = current_time
            
            # Set created_date if it's a new plan
            if 'created_date' not in plan_data:
                plan_data['created_date'] = current_time
            
            # Save to disk
            plan_path = os.path.join(PLANS_DIR, f"{plan_name}.json")
            with open(plan_path, 'w') as f:
                json.dump(plan_data, f, indent=2)
            
            # Update cache
            with self._lock:
                if self._plans_cache is not None:
                    self._plans_cache[plan_name] = plan_data
            
            logger.info(f"Saved plan: {plan_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving plan {plan_name}: {e}")
            return False
    
    def get_plan(self, plan_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific plan."""
        plans = self.get_plans_cache()
        return plans.get(plan_name)
    
    def list_plans(self) -> List[Dict[str, Any]]:
        """Get all plans with summary information."""
        plans = self.get_plans_cache()

        plan_list = []
        for plan_name, plan_data in plans.items():
            plan_list.append({
                "plan_name": plan_name,
                "created_date": plan_data.get("created_date"),
                "last_modified_date": plan_data.get("last_modified_date"),
                "created_by": plan_data.get("created_by")
            })

        # Sort by last modified date (newest first)
        plan_list.sort(
            key=lambda x: x.get("last_modified_date", ""),
            reverse=True
        )

        return plan_list
    
    def delete_plan(self, plan_name: str) -> bool:
        """Delete a plan from disk and cache."""
        try:
            # Remove from disk
            plan_path = os.path.join(PLANS_DIR, f"{plan_name}.json")
            if os.path.exists(plan_path):
                os.remove(plan_path)
            
            # Remove from cache
            with self._lock:
                if self._plans_cache is not None and plan_name in self._plans_cache:
                    del self._plans_cache[plan_name]
            
            logger.info(f"Deleted plan: {plan_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting plan {plan_name}: {e}")
            return False
    
    def plan_exists(self, plan_name: str) -> bool:
        """Check if a plan exists."""
        plans = self.get_plans_cache()
        return plan_name in plans

    def reassign_plan_owner(self, plan_name: str, new_owner: str) -> bool:
        """Reassign plan to a new owner."""
        try:
            plan = self.get_plan(plan_name)
            if not plan:
                logger.warning(f"Plan {plan_name} not found")
                return False

            plan['created_by'] = new_owner
            return self.save_plan(plan_name, plan)

        except Exception as e:
            logger.error(f"Error reassigning plan owner for {plan_name}: {e}")
            return False


# Initialize the global cache instance
_cache = PlanCache()


def save_plan(plan_name: str, raw_plan: Dict[str, Any], created_by: str) -> bool:
    """Save a plan with the given data."""
    if not created_by:
        raise ValueError("created_by is required")

    plan_data = {
        "raw_plan": raw_plan,
        "created_by": created_by
    }
    return _cache.save_plan(plan_name, plan_data)


def get_plan(plan_name: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get a specific plan, with access validation."""
    if current_user:
        from core.auth import permissions
        if not permissions.has_plan_access(current_user, plan_name):
            return None
    return _cache.get_plan(plan_name)


def list_plans(current_user: str) -> List[Dict[str, Any]]:
    """Get all plans, filtered by user access."""
    all_plans = _cache.list_plans()

    # Import here to avoid circular dependency
    from core.auth import permissions

    # Admin sees everything
    if permissions.is_admin(current_user):
        return all_plans

    # Filter: only plans created by current_user
    return [p for p in all_plans if p.get('created_by') == current_user]


def delete_plan(plan_name: str) -> bool:
    """Delete a plan."""
    return _cache.delete_plan(plan_name)


def plan_exists(plan_name: str) -> bool:
    """Check if a plan exists."""
    return _cache.plan_exists(plan_name)


def reassign_plan_owner(plan_name: str, new_owner: str) -> bool:
    """Reassign plan to a new owner."""
    return _cache.reassign_plan_owner(plan_name, new_owner)


def invalidate_plan_cache():
    """Force reload of plan cache."""
    _cache.invalidate()