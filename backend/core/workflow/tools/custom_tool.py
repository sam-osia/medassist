"""UserDefinedTool — makes user-defined custom tools executable.

Builds dynamic Pydantic Input/Output models from field definitions,
renders Jinja2 templates with StrictUndefined, and calls the LLM
with structured output.
"""

from typing import Any, Dict, List, Literal, Optional, Tuple, Type

from jinja2 import Template, StrictUndefined, UndefinedError
from pydantic import BaseModel, Field, create_model

from core.llm_provider import call
from core.workflow.schemas.custom_tool_schema import CustomToolManifest, FieldDefinition
from core.workflow.schemas.tool_inputs import PromptInput, ModelInput
from core.workflow.tools.base import Tool, ToolCallMeta, meta_from_llm_result


# Map field_type strings to Python types
_TYPE_MAP = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
}


def _python_type_for_field(fd: FieldDefinition):
    """Return the Python type annotation for a field definition.

    For enum fields, returns Literal[coerced_values] preserving the base type.
    """
    base_type = _TYPE_MAP[fd.field_type]
    if fd.is_enum and fd.enum_values:
        coerced = tuple(base_type(v) for v in fd.enum_values)
        return Literal[coerced]
    return base_type


def _build_field_tuple(fd: FieldDefinition) -> Tuple[Any, Any]:
    """Convert a FieldDefinition to a (type, FieldInfo) tuple for create_model()."""
    py_type = _python_type_for_field(fd)
    extra = {}
    if fd.is_enum and fd.enum_values:
        extra["json_schema_extra"] = {"enum": fd.enum_values}

    field_info = Field(
        description=fd.description or fd.label,
        default=fd.default_value if not fd.required else ...,
        **extra,
    )

    if not fd.required:
        py_type = Optional[py_type]

    return (py_type, field_info)


def build_input_model(manifest: CustomToolManifest) -> Type[BaseModel]:
    """Create a dynamic Pydantic model from the manifest's input_fields + PromptInput."""
    fields = {}
    for fd in manifest.input_fields:
        fields[fd.name] = _build_field_tuple(fd)

    # Always include optional PromptInput field
    fields["prompt"] = (Optional[PromptInput], Field(default=None, description="Prompt configuration"))
    fields["model"] = (Optional[ModelInput], Field(default=None, description="LLM model selection"))

    model_name = f"{manifest.tool_name}_Input"
    return create_model(model_name, **fields)


def build_output_model(manifest: CustomToolManifest) -> Type[BaseModel]:
    """Create a dynamic Pydantic model from the manifest's output_fields."""
    fields = {}
    for fd in manifest.output_fields:
        fields[fd.name] = _build_field_tuple(fd)

    model_name = f"{manifest.tool_name}_Output"
    return create_model(model_name, **fields)


class UserDefinedTool(Tool):
    """A tool created from a user-defined CustomToolManifest."""

    def __init__(self, manifest: CustomToolManifest):
        self._manifest = manifest
        self.Input = build_input_model(manifest)
        self.Output = build_output_model(manifest)

    @property
    def name(self) -> str:
        return self._manifest.tool_name

    @property
    def description(self) -> str:
        return self._manifest.description or self._manifest.display_name

    @property
    def display_name(self) -> str:
        return self._manifest.display_name

    @property
    def user_description(self) -> str:
        return self._manifest.description or self._manifest.display_name

    @property
    def uses_llm(self) -> bool:
        return True

    @property
    def role(self) -> str:
        return "compute"

    @property
    def category(self) -> str:
        return self._manifest.category or "custom"

    @property
    def input_help(self) -> Dict[str, str]:
        return {
            "prompt": "Configure the system and user prompts. Use Jinja2 template variables like {{field_name}} to reference input fields."
        }

    @property
    def prompt_defaults(self) -> Dict[str, Any]:
        return self._manifest.prompt_defaults.model_dump()

    def __call__(self, inputs) -> Any:
        input_dict = inputs.model_dump()

        # Extract key_name before removing model from input_dict
        model_input = getattr(inputs, 'model', None)
        key_name = model_input.key_name if model_input else None
        input_dict.pop("model", None)

        # Extract prompt, fall back to manifest defaults
        prompt_data = input_dict.pop("prompt", None)
        if not prompt_data or not prompt_data.get("system_prompt"):
            prompt_data = self._manifest.prompt_defaults.model_dump()

        # Build Jinja2 context from remaining input fields
        context = {k: v for k, v in input_dict.items() if v is not None}

        # Render templates with StrictUndefined
        try:
            system_prompt = Template(
                prompt_data["system_prompt"], undefined=StrictUndefined
            ).render(context)
            user_prompt = Template(
                prompt_data["user_prompt"], undefined=StrictUndefined
            ).render(context)
        except UndefinedError as e:
            available = list(context.keys())
            raise ValueError(
                f"Template error: {e}. Available variables: {available}"
            )

        # Build messages (with few-shot examples if provided)
        messages = []
        examples = prompt_data.get("examples") or []
        for ex in examples:
            if isinstance(ex, dict) and "user_input" in ex and "assistant_response" in ex:
                rendered_user = Template(
                    ex["user_input"], undefined=StrictUndefined
                ).render(context)
                rendered_assistant = Template(
                    ex["assistant_response"], undefined=StrictUndefined
                ).render(context)
                messages.append({"role": "user", "content": rendered_user})
                messages.append({"role": "assistant", "content": rendered_assistant})

        messages.append({"role": "user", "content": user_prompt})

        try:
            result = call(
                messages=messages,
                key_name=key_name,
                system=system_prompt,
                schema=self.Output,
            )
            return result.parsed, meta_from_llm_result(result)
        except Exception as e:
            print(f"Custom tool LLM call failed: {e}")
            # Build a fallback output with empty/default values
            fallback_fields = {}
            for fd in self._manifest.output_fields:
                if fd.field_type == "string":
                    fallback_fields[fd.name] = f"Error: {e}"
                elif fd.field_type == "boolean":
                    fallback_fields[fd.name] = False
                elif fd.field_type in ("integer", "number"):
                    fallback_fields[fd.name] = 0
            return self.Output(**fallback_fields), ToolCallMeta()
