"""Simplified output schemas for workflow outputs.

This module defines how workflow outputs are structured and mapped.
Outputs capture the meaningful results of a workflow execution.
"""

from pydantic import BaseModel, ConfigDict
from typing import Dict, List, Optional, Literal


# Aligned with annotation field types
FieldType = Literal["boolean", "text", "numeric", "categorical"]

# Resource types that outputs can reference
ResourceType = Literal["note", "medication", "diagnosis", "flowsheet", "encounter"]


class OutputField(BaseModel):
    """A single output field."""
    model_config = ConfigDict(extra="forbid")
    name: str
    type: FieldType
    description: Optional[str] = None


class OutputDefinition(BaseModel):
    """
    Defines a workflow output.

    The definition describes the structure - what fields the output has,
    what tool generated it (for custom UI rendering), etc.

    Examples:
        Direct output (tied to single document):
            OutputDefinition(
                id="def_depression",
                name="depression_indicator",
                label="Depression Indicator",
                fields=[OutputField(name="detected", type="boolean"), ...],
                tool_name="analyze_note_with_span_and_reason"
            )

        Aggregated output (combines multiple sources):
            OutputDefinition(
                id="def_combined",
                name="combined_analysis",
                label="Combined Analysis",
                fields=[OutputField(name="summary", type="text"), ...],
                tool_name="summarize_combined_text"
            )
    """
    model_config = ConfigDict(extra="forbid")

    id: str  # e.g., "def_depression_indicator"
    name: str  # e.g., "depression_indicator" (machine-readable)
    label: str  # e.g., "Depression Indicator" (human-readable)
    description: Optional[str] = None

    # The output fields (detected, reasoning, span, etc.)
    fields: List[OutputField]

    # Which tool generated this output (for custom UI rendering)
    # If None, default renderer is used
    tool_name: Optional[str] = None


class EvidenceMapping(BaseModel):
    """
    Maps a source document to an output.

    At runtime, id_path is resolved to get the actual resource ID.
    """
    model_config = ConfigDict(extra="forbid")
    resource_type: ResourceType
    id_path: str  # Variable path to resource ID (e.g., "loop.note.note_id")


class OutputMapping(BaseModel):
    """
    Maps workflow variables to an output definition.

    This is the runtime binding - connects workflow step outputs
    to the abstract output definition.

    Examples:
        Direct output (single document):
            OutputMapping(
                output_definition_id="def_depression",
                field_mappings={
                    "detected": "analyze.flag_state",
                    "reasoning": "analyze.reasoning"
                },
                evidence=[
                    EvidenceMapping(resource_type="note", id_path="loop.note.note_id")
                ],
                condition="analyze.flag_state == true"
            )

        Aggregated output with document references:
            OutputMapping(
                output_definition_id="def_combined",
                field_mappings={
                    "input_text": "aggregate.combined_text",
                    "detected": "final.flag_state"
                },
                evidence=[
                    EvidenceMapping(resource_type="note", id_path="matched_notes[0].note_id"),
                    EvidenceMapping(resource_type="medication", id_path="med.order_id")
                ]
            )

        Aggregated output without explicit document references:
            OutputMapping(
                output_definition_id="def_summary",
                field_mappings={"summary": "summarize.text"},
                evidence=[]  # No document links, just show the summary
            )
    """
    model_config = ConfigDict(extra="forbid")

    output_definition_id: str

    # Maps field name → variable path
    # e.g., {"detected": "step_analyze.flag_state", "reasoning": "step_analyze.reasoning"}
    field_mappings: Dict[str, str]

    # Evidence: which documents this output references
    # - Empty list: no document references (pure computation/aggregation)
    # - Single item: direct output tied to one document
    # - Multiple items: aggregated output with explicit document refs
    evidence: List[EvidenceMapping] = []

    # Condition for when to create this output
    # e.g., "step_analyze.flag_state == true"
    condition: Optional[str] = None
