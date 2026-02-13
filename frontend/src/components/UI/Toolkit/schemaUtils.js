/**
 * Resolve a field's type from its JSON Schema, handling Pydantic v2's
 * anyOf/$ref pattern for Optional[T] fields.
 *
 * Returns:
 * - The direct "type" if present (e.g., "string", "integer", "object")
 * - The $defs title if the field uses anyOf with a $ref (e.g., "PromptInput", "ModelInput")
 * - null if neither can be determined
 */
export function resolveFieldType(fieldSchema, rootSchema) {
  if (!fieldSchema) return null;

  // Direct type (covers most fields)
  if (fieldSchema.type) return fieldSchema.type;

  // anyOf pattern from Pydantic v2 Optional[T] — e.g. anyOf: [{$ref: "#/$defs/PromptInput"}, {type: "null"}]
  const ref = fieldSchema.anyOf?.find(entry => entry.$ref)?.$ref;
  if (ref && rootSchema?.$defs) {
    const defName = ref.replace('#/$defs/', '');
    return rootSchema.$defs[defName]?.title || defName;
  }

  return null;
}
