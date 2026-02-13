"""Pydantic models for user-defined custom tool definitions."""

import re
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, field_validator, model_validator


FIELD_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
RESERVED_FIELD_NAMES = {"prompt", "model"}
MAX_FIELDS = 20
MAX_ENUM_VALUES = 20


class FieldDefinition(BaseModel):
    """A single user-defined input or output field."""

    name: str
    label: str
    field_type: Literal["string", "integer", "number", "boolean"]
    description: str = ""
    required: bool = True
    is_enum: bool = False
    enum_values: Optional[List[str]] = None
    default_value: Optional[Any] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not FIELD_NAME_PATTERN.match(v):
            raise ValueError(f"Field name '{v}' must match ^[a-z][a-z0-9_]*$")
        if v in RESERVED_FIELD_NAMES:
            raise ValueError(f"Field name '{v}' is reserved")
        return v

    @model_validator(mode="after")
    def validate_enum_consistency(self):
        if self.is_enum:
            if not self.enum_values or len(self.enum_values) == 0:
                raise ValueError("enum_values required when is_enum is True")
            if len(self.enum_values) > MAX_ENUM_VALUES:
                raise ValueError(f"enum_values cannot exceed {MAX_ENUM_VALUES}")
        else:
            if self.enum_values is not None:
                raise ValueError("enum_values must be None when is_enum is False")
        return self


class PromptDefaults(BaseModel):
    """Stored default prompts for a custom tool."""

    system_prompt: str
    user_prompt: str
    examples: Optional[List[dict]] = None


class CustomToolManifest(BaseModel):
    """Complete definition of a user-defined custom tool."""

    schema_version: int = 1
    execution_type: Literal["llm_structured"] = "llm_structured"
    tool_id: str
    tool_name: str
    display_name: str
    description: str = ""
    category: str = "custom"
    created_by: str
    created_at: str
    updated_at: str
    input_fields: List[FieldDefinition] = []
    output_fields: List[FieldDefinition]
    prompt_defaults: PromptDefaults

    @field_validator("tool_name")
    @classmethod
    def validate_tool_name(cls, v: str) -> str:
        if not FIELD_NAME_PATTERN.match(v):
            raise ValueError(f"tool_name '{v}' must match ^[a-z][a-z0-9_]*$")
        return v

    @field_validator("output_fields")
    @classmethod
    def validate_output_fields_nonempty(cls, v: List[FieldDefinition]) -> List[FieldDefinition]:
        if len(v) == 0:
            raise ValueError("At least one output field is required")
        return v

    @model_validator(mode="after")
    def validate_field_constraints(self):
        if len(self.input_fields) > MAX_FIELDS:
            raise ValueError(f"input_fields cannot exceed {MAX_FIELDS}")
        if len(self.output_fields) > MAX_FIELDS:
            raise ValueError(f"output_fields cannot exceed {MAX_FIELDS}")

        input_names = [f.name for f in self.input_fields]
        if len(input_names) != len(set(input_names)):
            raise ValueError("input_fields must have unique names")

        output_names = [f.name for f in self.output_fields]
        if len(output_names) != len(set(output_names)):
            raise ValueError("output_fields must have unique names")

        return self
