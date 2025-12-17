import json
import math

def safe_json_dumps(obj):
    """Convert NaN values to None before JSON serialization"""
    def convert_nan(obj):
        if isinstance(obj, dict):
            return {k: convert_nan(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_nan(item) for item in obj]
        elif isinstance(obj, float) and math.isnan(obj):
            return None
        else:
            return obj
    
    return json.dumps(convert_nan(obj))

def publish_tool_call(tool_name, args, category=None):
    event_data = {
        "event": "tool_call",
        "tool_name": tool_name,
        "args": args
    }
    
    if category:
        event_data["category"] = category
        
    yield safe_json_dumps(event_data) + "\n"

def publish_tool_result(tool_name, result, category=None):
    event_data = {
        "event": "tool_result",
        "tool_name": tool_name,
        "result": result
    }
    
    if category:
        event_data["category"] = category
        
    yield safe_json_dumps(event_data) + "\n"

def publish_llm_thinking():
    yield safe_json_dumps({
        "event": "llm_thinking"
    }) + "\n"

def publish_error(stage, message, tool_name=None, args=None, raw_args=None):
    event_data = {
        "event": "error",
        "stage": stage,
        "message": message
    }
    
    if tool_name:
        event_data["tool_name"] = tool_name
    if args:
        event_data["args"] = args
    if raw_args:
        event_data["raw_args"] = raw_args
        
    yield safe_json_dumps(event_data) + "\n"

def publish_final_result(content):
    yield safe_json_dumps({
        "event": "final_result",
        "content": content
    }) + "\n"

def publish_tool_call_with_data_item(tool_name, args, data_item_type=None, data_item_id=None, status="processing", category=None):
    """Enhanced tool call event with data item tracking"""

    event_data = {
        "event": "tool_call",
        "tool_name": tool_name,
        "args": args
    }
    
    if category:
        event_data["category"] = category
    
    if data_item_type and data_item_id is not None:
        event_data["dataItem"] = {
            "type": data_item_type,
            "id": str(data_item_id),
            "status": status
        }

    yield safe_json_dumps(event_data) + "\n"

def publish_tool_result_with_data_item(tool_name, result, data_item_type=None, data_item_id=None, status="completed", category=None):
    """Enhanced tool result event with data item tracking"""
    event_data = {
        "event": "tool_result",
        "tool_name": tool_name,
        "result": result
    }
    
    if category:
        event_data["category"] = category
    
    if data_item_type and data_item_id is not None:
        event_data["dataItem"] = {
            "type": data_item_type,
            "id": str(data_item_id),
            "status": status
        }
        
    yield safe_json_dumps(event_data) + "\n"

def publish_progress_update(message, data_item_type=None, data_item_id=None, status="processing"):
    """General progress update tied to specific data items"""
    event_data = {
        "event": "progress_update",
        "message": message
    }
    
    if data_item_type and data_item_id is not None:
        event_data["dataItem"] = {
            "type": data_item_type,
            "id": str(data_item_id),
            "status": status
        }
        
    yield safe_json_dumps(event_data) + "\n"

def publish_workflow_complete(workflow_type, mrn, csn):
    """Signal that a workflow has completed successfully"""
    event_data = {
        "event": "workflow_complete",
        "workflow_type": workflow_type,
        "mrn": mrn,
        "csn": csn
    }
    
    yield safe_json_dumps(event_data) + "\n"