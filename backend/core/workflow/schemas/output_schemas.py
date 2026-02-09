"""Simplified output definition schema.

An output definition is a lightweight pointer that links a workflow step
to its tool, giving it a human-readable name for display and evaluation pairing.
The actual output fields are derived from the tool's output schema in the registry.
"""

from pydantic import BaseModel


class OutputDefinition(BaseModel):
    """
    A named pointer to a compute tool step whose result is a workflow output.

    Fields/schema are NOT stored here — they come from the tool's output
    Pydantic model via the registry at runtime.
    """
    id: str          # e.g. "out_analyze_depression"
    name: str        # machine-readable, e.g. "analyze_depression"
    label: str       # human-readable, e.g. "Analyze note for depression indicators"
    tool_name: str   # e.g. "analyze_note_with_span_and_reason" — drives schema + custom UI
    step_id: str     # links to the ToolStep.id in the workflow
