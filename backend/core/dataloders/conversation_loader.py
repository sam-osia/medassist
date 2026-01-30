import json
import logging
import os
from typing import List, Dict, Any, Optional
from threading import Lock
import datetime

logger = logging.getLogger(__name__)

# Configuration
CONVERSATIONS_DIR = "conversations"

class ConversationCache:
    """Thread-safe singleton cache for conversation data."""
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
                self._conversations_cache = None
                self._initialized = True

    def get_conversations_cache(self) -> Dict[str, Any]:
        """Get cached conversations, loading them if necessary."""
        if self._conversations_cache is None:
            with self._lock:
                if self._conversations_cache is None:  # Double-check lock pattern
                    self._conversations_cache = self._load_all_conversations()
        return self._conversations_cache

    def invalidate(self):
        """Clear the cached conversations."""
        with self._lock:
            self._conversations_cache = None

    def _load_all_conversations(self) -> Dict[str, Any]:
        """Load all conversations from disk."""
        logger.info("Loading conversations from disk...")

        conversations = {}

        if not os.path.exists(CONVERSATIONS_DIR):
            os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
            logger.info(f"Created conversations directory: {CONVERSATIONS_DIR}")
            return conversations

        for filename in os.listdir(CONVERSATIONS_DIR):
            if not filename.endswith('.json'):
                continue

            conversation_id = filename[:-5]  # Remove .json extension
            conversation_path = os.path.join(CONVERSATIONS_DIR, filename)

            try:
                with open(conversation_path, 'r') as f:
                    conversation_data = json.load(f)

                # Validate required fields
                required_fields = ['conversation_id', 'created_date', 'messages']
                if all(field in conversation_data for field in required_fields):
                    conversations[conversation_id] = conversation_data
                else:
                    logger.warning(f"Conversation {conversation_id} missing required fields, skipping")

            except Exception as e:
                logger.error(f"Error loading conversation {conversation_id}: {e}")
                continue

        logger.info(f"Loaded {len(conversations)} conversations from disk")
        return conversations

    def save_conversation(self, conversation_id: str, data: Dict[str, Any], created_by: str = None) -> bool:
        """Save a conversation to disk and update cache.

        Args:
            conversation_id: Unique identifier for the conversation
            data: Dict with 'messages' (list) and 'workflows' (dict) keys
            created_by: User ID who created the conversation
        """
        try:
            # Ensure conversations directory exists
            os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

            # Extract messages and workflows from data
            messages = data.get("messages", [])
            workflows = data.get("workflows", {})

            # Load existing conversation or create new
            existing_conversation = self.get_conversation(conversation_id)

            current_time = datetime.datetime.now().isoformat()

            # Build conversation data
            conversation_data = {
                "conversation_id": conversation_id,
                "messages": messages,
                "workflows": workflows,
                "last_message_date": current_time
            }

            # If new conversation, set created_date and created_by
            if existing_conversation:
                conversation_data['created_date'] = existing_conversation.get('created_date', current_time)
                conversation_data['created_by'] = existing_conversation.get('created_by', created_by)
            else:
                conversation_data['created_date'] = current_time
                if created_by:
                    conversation_data['created_by'] = created_by

            # Generate title from first user message if not already set
            if existing_conversation and 'title' in existing_conversation:
                conversation_data['title'] = existing_conversation['title']
            else:
                # Find first user message
                first_user_message = next((msg for msg in messages if msg.get('type') == 'user'), None)
                if first_user_message:
                    content = first_user_message.get('content', '')
                    conversation_data['title'] = content[:100] + '...' if len(content) > 100 else content
                else:
                    conversation_data['title'] = 'New Conversation'

            # Save to disk
            conversation_path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
            with open(conversation_path, 'w') as f:
                json.dump(conversation_data, f, indent=2)

            # Update cache
            with self._lock:
                if self._conversations_cache is not None:
                    self._conversations_cache[conversation_id] = conversation_data

            logger.info(f"Saved conversation: {conversation_id}")
            return True

        except Exception as e:
            logger.error(f"Error saving conversation {conversation_id}: {e}")
            return False

    def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific conversation."""
        conversations = self.get_conversations_cache()
        return conversations.get(conversation_id)

    def list_conversations(self, created_by: str = None) -> List[Dict[str, Any]]:
        """Get all conversations, optionally filtered by creator."""
        conversations = self.get_conversations_cache()

        conversation_list = []
        for conversation_id, conversation_data in conversations.items():
            # Filter by creator if specified
            if created_by and conversation_data.get('created_by') != created_by:
                continue

            conversation_list.append({
                "conversation_id": conversation_id,
                "created_date": conversation_data.get("created_date"),
                "last_message_date": conversation_data.get("last_message_date"),
                "title": conversation_data.get("title", "Untitled Conversation"),
                "created_by": conversation_data.get("created_by")
            })

        # Sort by last message date (newest first)
        conversation_list.sort(
            key=lambda x: x.get("last_message_date", ""),
            reverse=True
        )

        return conversation_list

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation from disk and cache."""
        try:
            # Remove from disk
            conversation_path = os.path.join(CONVERSATIONS_DIR, f"{conversation_id}.json")
            if os.path.exists(conversation_path):
                os.remove(conversation_path)

            # Remove from cache
            with self._lock:
                if self._conversations_cache is not None and conversation_id in self._conversations_cache:
                    del self._conversations_cache[conversation_id]

            logger.info(f"Deleted conversation: {conversation_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}")
            return False

    def conversation_exists(self, conversation_id: str) -> bool:
        """Check if a conversation exists."""
        conversations = self.get_conversations_cache()
        return conversation_id in conversations


# Initialize the global cache instance
_cache = ConversationCache()


def save_conversation(conversation_id: str, data: Dict[str, Any], created_by: str = None) -> bool:
    """Save a conversation with the given data.

    Args:
        conversation_id: Unique identifier for the conversation
        data: Dict with 'messages' (list) and 'workflows' (dict) keys
        created_by: User ID who created the conversation
    """
    return _cache.save_conversation(conversation_id, data, created_by)


def get_conversation(conversation_id: str, current_user: str = None) -> Optional[Dict[str, Any]]:
    """Get a specific conversation, with access validation."""
    conversation = _cache.get_conversation(conversation_id)

    if not conversation:
        return None

    # Access control: users can only see their own conversations
    if current_user:
        from core.auth import permissions
        # Admins can see all
        if permissions.is_admin(current_user):
            return conversation
        # Regular users can only see their own
        if conversation.get('created_by') != current_user:
            return None

    return conversation


def list_conversations(current_user: str = None) -> List[Dict[str, Any]]:
    """Get all conversations, filtered by user access."""
    # No filtering if no user specified (backward compatibility)
    if not current_user:
        return _cache.list_conversations()

    # Import here to avoid circular dependency
    from core.auth import permissions

    # Admin sees everything
    if permissions.is_admin(current_user):
        return _cache.list_conversations()

    # Filter: only conversations created by current_user
    return _cache.list_conversations(created_by=current_user)


def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation."""
    return _cache.delete_conversation(conversation_id)


def conversation_exists(conversation_id: str) -> bool:
    """Check if a conversation exists."""
    return _cache.conversation_exists(conversation_id)


def invalidate_conversation_cache():
    """Force reload of conversation cache."""
    _cache.invalidate()
