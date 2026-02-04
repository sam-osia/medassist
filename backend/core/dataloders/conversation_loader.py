import json
import logging
import os
import shutil
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
        """Load all conversations from disk (folder structure)."""
        logger.info("Loading conversations from disk...")

        conversations = {}

        if not os.path.exists(CONVERSATIONS_DIR):
            os.makedirs(CONVERSATIONS_DIR, exist_ok=True)
            logger.info(f"Created conversations directory: {CONVERSATIONS_DIR}")
            return conversations

        for item in os.listdir(CONVERSATIONS_DIR):
            item_path = os.path.join(CONVERSATIONS_DIR, item)

            # New format: folder with conversation.json inside
            if os.path.isdir(item_path):
                conversation_id = item
                conversation_path = os.path.join(item_path, "conversation.json")

                if not os.path.exists(conversation_path):
                    logger.warning(f"Folder {item} has no conversation.json, skipping")
                    continue

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

    def save_conversation(self, conversation_id: str, data: Dict[str, Any], created_by: str = None) -> Dict[str, Any]:
        """Save a conversation to disk (folder structure) and update cache.

        Args:
            conversation_id: Unique identifier for the conversation
            data: Dict with 'messages' (list) and 'workflows' (dict) keys
            created_by: User ID who created the conversation
        """
        try:
            # Create conversation folder
            conversation_folder = os.path.join(CONVERSATIONS_DIR, conversation_id)
            os.makedirs(conversation_folder, exist_ok=True)

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

            # Calculate cumulative cost totals from all assistant messages
            total_cost = 0.0
            total_input_tokens = 0
            total_output_tokens = 0
            for msg in messages:
                if msg.get('type') == 'assistant':
                    total_cost += msg.get('cost', 0.0) or 0.0
                    total_input_tokens += msg.get('input_tokens', 0) or 0
                    total_output_tokens += msg.get('output_tokens', 0) or 0

            conversation_data['total_cost'] = total_cost
            conversation_data['total_input_tokens'] = total_input_tokens
            conversation_data['total_output_tokens'] = total_output_tokens

            # Save to disk (folder structure)
            conversation_path = os.path.join(conversation_folder, "conversation.json")
            with open(conversation_path, 'w') as f:
                json.dump(conversation_data, f, indent=2)

            # Update cache
            with self._lock:
                if self._conversations_cache is not None:
                    self._conversations_cache[conversation_id] = conversation_data

            logger.info(f"Saved conversation: {conversation_id}")
            return {
                "success": True,
                "total_cost": total_cost,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens
            }

        except Exception as e:
            logger.error(f"Error saving conversation {conversation_id}: {e}")
            return {
                "success": False,
                "total_cost": 0.0,
                "total_input_tokens": 0,
                "total_output_tokens": 0
            }

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
                "created_by": conversation_data.get("created_by"),
                "total_cost": conversation_data.get("total_cost", 0.0),
                "total_input_tokens": conversation_data.get("total_input_tokens", 0),
                "total_output_tokens": conversation_data.get("total_output_tokens", 0)
            })

        # Sort by last message date (newest first)
        conversation_list.sort(
            key=lambda x: x.get("last_message_date", ""),
            reverse=True
        )

        return conversation_list

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation folder from disk and cache."""
        try:
            # Remove folder from disk
            conversation_folder = os.path.join(CONVERSATIONS_DIR, conversation_id)
            if os.path.isdir(conversation_folder):
                shutil.rmtree(conversation_folder)

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

    def save_trace(self, conversation_id: str, turn_number: int, trace_lines: List[str]) -> Optional[str]:
        """Save trace data for a conversation turn.

        Args:
            conversation_id: The conversation ID
            turn_number: The turn number (1-indexed)
            trace_lines: List of JSON strings (one per event)

        Returns:
            Path to the trace file, or None if failed
        """
        try:
            # Create traces folder inside conversation folder
            traces_folder = os.path.join(CONVERSATIONS_DIR, conversation_id, "traces")
            os.makedirs(traces_folder, exist_ok=True)

            # Write trace file
            trace_filename = f"turn_{turn_number:03d}.jsonl"
            trace_path = os.path.join(traces_folder, trace_filename)

            with open(trace_path, 'w') as f:
                for line in trace_lines:
                    f.write(line + '\n')

            logger.info(f"Saved trace for conversation {conversation_id}, turn {turn_number}")

            # Generate visualization
            self._generate_visualization(conversation_id, turn_number, trace_lines)

            return trace_path

        except Exception as e:
            logger.error(f"Error saving trace for {conversation_id}, turn {turn_number}: {e}")
            return None

    def _generate_visualization(self, conversation_id: str, turn_number: int, trace_lines: List[str]):
        """Generate HTML visualization for a trace.

        Args:
            conversation_id: The conversation ID
            turn_number: The turn number (1-indexed)
            trace_lines: List of JSON strings (trace events)
        """
        try:
            from core.workflow.trace_visualizer import HTMLTraceVisualizer

            # Parse trace events
            parsed_events = [json.loads(line) for line in trace_lines]

            # Generate visualization
            metadata = {
                "conversation_id": conversation_id,
                "turn_number": turn_number
            }
            visualizer = HTMLTraceVisualizer()
            html_content = visualizer.generate(parsed_events, metadata)

            # Save visualization
            self.save_visualization(conversation_id, turn_number, html_content)

        except Exception as e:
            logger.error(f"Error generating visualization for {conversation_id}, turn {turn_number}: {e}")

    def save_visualization(self, conversation_id: str, turn_number: int, html_content: str) -> Optional[str]:
        """Save visualization HTML for a conversation turn.

        Args:
            conversation_id: The conversation ID
            turn_number: The turn number (1-indexed)
            html_content: The HTML content to save

        Returns:
            Path to the visualization file, or None if failed
        """
        try:
            viz_folder = os.path.join(CONVERSATIONS_DIR, conversation_id, "visualizations")
            os.makedirs(viz_folder, exist_ok=True)

            viz_filename = f"turn_{turn_number:03d}.html"
            viz_path = os.path.join(viz_folder, viz_filename)

            with open(viz_path, 'w') as f:
                f.write(html_content)

            logger.info(f"Saved visualization for conversation {conversation_id}, turn {turn_number}")
            return viz_path

        except Exception as e:
            logger.error(f"Error saving visualization for {conversation_id}, turn {turn_number}: {e}")
            return None

    def get_trace(self, conversation_id: str, turn_number: int) -> Optional[List[Dict[str, Any]]]:
        """Get trace data for a conversation turn.

        Args:
            conversation_id: The conversation ID
            turn_number: The turn number (1-indexed)

        Returns:
            List of trace events, or None if not found
        """
        try:
            trace_filename = f"turn_{turn_number:03d}.jsonl"
            trace_path = os.path.join(CONVERSATIONS_DIR, conversation_id, "traces", trace_filename)

            if not os.path.exists(trace_path):
                return None

            events = []
            with open(trace_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        events.append(json.loads(line))

            return events

        except Exception as e:
            logger.error(f"Error loading trace for {conversation_id}, turn {turn_number}: {e}")
            return None

    def list_traces(self, conversation_id: str) -> List[int]:
        """List all available trace turn numbers for a conversation.

        Returns:
            List of turn numbers that have traces
        """
        traces_folder = os.path.join(CONVERSATIONS_DIR, conversation_id, "traces")

        if not os.path.isdir(traces_folder):
            return []

        turn_numbers = []
        for filename in os.listdir(traces_folder):
            if filename.startswith("turn_") and filename.endswith(".jsonl"):
                try:
                    # Extract turn number from filename like "turn_001.jsonl"
                    turn_str = filename[5:-6]  # Remove "turn_" and ".jsonl"
                    turn_numbers.append(int(turn_str))
                except ValueError:
                    continue

        return sorted(turn_numbers)


# Initialize the global cache instance
_cache = ConversationCache()


def save_conversation(conversation_id: str, data: Dict[str, Any], created_by: str = None) -> Dict[str, Any]:
    """Save a conversation with the given data.

    Args:
        conversation_id: Unique identifier for the conversation
        data: Dict with 'messages' (list) and 'workflows' (dict) keys
        created_by: User ID who created the conversation

    Returns:
        Dict with 'success' (bool) and cumulative cost totals
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


def save_trace(conversation_id: str, turn_number: int, trace_lines: List[str]) -> Optional[str]:
    """Save trace data for a conversation turn."""
    return _cache.save_trace(conversation_id, turn_number, trace_lines)


def save_visualization(conversation_id: str, turn_number: int, html_content: str) -> Optional[str]:
    """Save visualization HTML for a conversation turn."""
    return _cache.save_visualization(conversation_id, turn_number, html_content)


def get_trace(conversation_id: str, turn_number: int) -> Optional[List[Dict[str, Any]]]:
    """Get trace data for a conversation turn."""
    return _cache.get_trace(conversation_id, turn_number)


def list_traces(conversation_id: str) -> List[int]:
    """List all available trace turn numbers for a conversation."""
    return _cache.list_traces(conversation_id)
