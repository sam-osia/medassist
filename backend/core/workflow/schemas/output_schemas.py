"""Output definition schemas for workflow output generation."""

from pydantic import BaseModel, ConfigDict
from typing import Dict, List, Optional, Literal, Union


class FieldSpec(BaseModel):
    """Specification for a single output field."""
    model_config = ConfigDict(extra="forbid")
    name: str
    type: Literal["boolean", "text", "number", "list"]
    description: Optional[str] = None


class DirectEvidenceSchema(BaseModel):
    """Evidence schema for direct (single resource) outputs."""
    model_config = ConfigDict(extra="forbid")
    type: Literal["direct"] = "direct"
    resource_type: Literal["note", "medication", "diagnosis", "flowsheet"]
    fields: List[FieldSpec] = []


class EvidenceSource(BaseModel):
    """A source of evidence in an aggregated output."""
    model_config = ConfigDict(extra="forbid")
    resource_type: Literal["note", "medication", "diagnosis", "flowsheet"]
    role: Literal["trigger", "source", "context"]
    fields: List[FieldSpec] = []


class AggregatedEvidenceSchema(BaseModel):
    """Evidence schema for aggregated (multiple resource) outputs."""
    model_config = ConfigDict(extra="forbid")
    type: Literal["aggregated"] = "aggregated"
    sources: List[EvidenceSource]


EvidenceSchema = Union[DirectEvidenceSchema, AggregatedEvidenceSchema]


class OutputDefinitionSpec(BaseModel):
    """Specification for a workflow output definition."""
    model_config = ConfigDict(extra="forbid")
    id: str  # e.g., "def_depression_indicator"
    name: str
    label: str
    description: Optional[str] = None
    output_type: Literal["direct", "aggregated"] = "direct"
    output_fields: List[FieldSpec]
    evidence_schema: EvidenceSchema


class FieldBinding(BaseModel):
    """A single field binding from evidence field to variable path."""
    model_config = ConfigDict(extra="forbid")
    field_name: str
    variable_path: str


class ValueSource(BaseModel):
    """A single value source mapping from output field to variable path."""
    model_config = ConfigDict(extra="forbid")
    output_field: str
    variable_path: str


class EvidenceSourceMapping(BaseModel):
    """Maps evidence from a workflow step to an output."""
    model_config = ConfigDict(extra="forbid")
    step_id: str
    resource_type: Literal["note", "medication", "diagnosis", "flowsheet"]
    role: Literal["trigger", "source", "context"]
    field_bindings: List[FieldBinding] = []


class OutputMapping(BaseModel):
    """Maps workflow step outputs to an output definition."""
    model_config = ConfigDict(extra="forbid")
    output_definition_id: str
    value_sources: List[ValueSource]  # Maps output fields to variable paths
    evidence_sources: List[EvidenceSourceMapping] = []
    condition: Optional[str] = None  # Optional condition for when this output is created
