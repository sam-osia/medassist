"""
Tool mapping utility for converting supervisor tool calls to data item events.

Maps tool names to data types and extracts relevant item IDs from tool arguments
to create consistent dataItem structures for frontend processing highlights.
"""

def get_data_item_from_tool(tool_name, tool_args):
    """
    Extract data item information from tool calls for processing highlights.
    
    Args:
        tool_name (str): Name of the tool being called
        tool_args (dict): Arguments passed to the tool
    
    Returns:
        dict or None: Data item info in format {type: str, id: str, status: str}
                      Returns None if tool doesn't correspond to specific data items
    """
    
    # Map tool names to data types
    tool_data_type_map = {
        'read_patient_note': 'notes',
        'summarize_patient_note': 'notes',
        'read_medication': 'medications',
        'read_diagnosis': 'diagnoses',
        'analyze_flowsheet_instance': 'flowsheets'
    }
    
    # Check if this tool corresponds to a specific data item
    data_type = tool_data_type_map.get(tool_name)
    if not data_type:
        return None
    
    # Extract item ID based on data type
    item_id = None
    
    if data_type == 'notes':
        item_id = tool_args.get('note_id')
    elif data_type == 'medications':
        item_id = tool_args.get('order_id')
    elif data_type == 'diagnoses':
        item_id = tool_args.get('diagnosis_id')
    elif data_type == 'flowsheets':
        # For flowsheets, we might have instance-specific IDs or general processing
        item_id = tool_args.get('instance_id', 'all')
    
    # Return data item info if we have both type and ID
    if item_id is not None:
        return {
            'type': data_type,
            'id': str(item_id),
            'status': 'processing'
        }
    
    return None


def should_use_data_item_events(tool_name):
    """
    Check if a tool should use data item events for processing highlights.
    
    Args:
        tool_name (str): Name of the tool
        
    Returns:
        bool: True if tool should emit data item events
    """
    data_item_tools = {
        'read_patient_note',
        'summarize_patient_note',
        'read_medication',
        'read_diagnosis',
        'analyze_flowsheet_instance'
    }
    
    return tool_name in data_item_tools