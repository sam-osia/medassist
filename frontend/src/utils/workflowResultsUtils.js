/**
 * Utilities for processing workflow results.
 *
 * Data format:
 * {
 *   output_definitions: [
 *     {
 *       id: string,
 *       name: string,
 *       label: string,
 *       resource_type: number,
 *       fields: [{name: string, type: number}, ...],
 *       metadata: {...}
 *     }
 *   ],
 *   output_values: [
 *     {
 *       id: string,
 *       output_definition_id: string,
 *       resource_id: string,
 *       values: {detected: boolean, ...},
 *       metadata: {patient_id: string, encounter_id: string, resource_details: {...}}
 *     }
 *   ]
 * }
 */

// Resource type constants (matching backend)
export const RESOURCE_TYPE_PATIENT = 1;
export const RESOURCE_TYPE_ENCOUNTER = 2;
export const RESOURCE_TYPE_NOTE = 3;
export const RESOURCE_TYPE_MEDICATION = 4;
export const RESOURCE_TYPE_DIAGNOSIS = 5;
export const RESOURCE_TYPE_FLOWSHEET = 6;

// Resource type name mapping
const RESOURCE_TYPE_NAMES = {
  [RESOURCE_TYPE_PATIENT]: 'patient',
  [RESOURCE_TYPE_ENCOUNTER]: 'encounter',
  [RESOURCE_TYPE_NOTE]: 'note',
  [RESOURCE_TYPE_MEDICATION]: 'medication',
  [RESOURCE_TYPE_DIAGNOSIS]: 'diagnosis',
  [RESOURCE_TYPE_FLOWSHEET]: 'flowsheet',
};

// String to number mapping for resource types
const RESOURCE_TYPE_MAP = {
  patient: RESOURCE_TYPE_PATIENT,
  encounter: RESOURCE_TYPE_ENCOUNTER,
  note: RESOURCE_TYPE_NOTE,
  medication: RESOURCE_TYPE_MEDICATION,
  medications: RESOURCE_TYPE_MEDICATION,
  diagnosis: RESOURCE_TYPE_DIAGNOSIS,
  flowsheet: RESOURCE_TYPE_FLOWSHEET,
};

/**
 * Get resource type name from type ID.
 *
 * @param {number} typeId - Resource type ID
 * @returns {string} Resource type name
 */
export function getResourceTypeName(typeId) {
  return RESOURCE_TYPE_NAMES[typeId] || 'unknown';
}

/**
 * Group results by output name for display.
 * Returns a structure compatible with flag display.
 *
 * @param {Object} data - Results object with output_definitions and output_values
 * @param {string|number} mrn - Patient MRN to filter by
 * @param {string|number} csn - Encounter CSN to filter by
 * @returns {Object} Grouped results: { flagName: { state: bool, sources: [...], definition: {...} } }
 */
export function groupResultsByFlag(data, mrn, csn) {
  if (!data) return {};

  const definitions = data.output_definitions || [];
  const values = data.output_values || [];

  // Build definition lookup
  const defLookup = {};
  for (const def of definitions) {
    defLookup[def.id] = def;
  }

  // Filter values for this patient/encounter
  const filtered = values.filter((v) => {
    const patientId = v.metadata?.patient_id;
    const encounterId = v.metadata?.encounter_id;
    return (
      String(patientId) === String(mrn) && String(encounterId) === String(csn)
    );
  });

  // Group by definition name
  const grouped = {};

  for (const v of filtered) {
    const def = defLookup[v.output_definition_id];
    if (!def) continue;

    const name = def.name;

    if (!grouped[name]) {
      grouped[name] = {
        state: false,
        sources: [],
        definition: def
      };
    }

    if (v.values?.detected) {
      grouped[name].state = true;

      // Get resource type name for the source
      const resourceTypeName = getResourceTypeName(def.resource_type);

      grouped[name].sources.push({
        type: resourceTypeName,
        resource_id: v.resource_id,
        values: v.values,
        metadata: v.metadata
      });
    }
  }

  return grouped;
}

/**
 * Extract highlighted item IDs from results for a specific resource type.
 *
 * @param {Object} data - Results data with output_definitions and output_values
 * @param {string} resourceType - Resource type to filter by (e.g., 'note', 'medication')
 * @returns {Array} Array of unique resource IDs that were detected
 */
export function getHighlightedItemsFromResults(data, resourceType) {
  if (!data) return [];

  const definitions = data.output_definitions || [];
  const values = data.output_values || [];

  // Convert string resource type to number for comparison
  const targetTypeNum = RESOURCE_TYPE_MAP[resourceType.toLowerCase()];

  // Build definition lookup
  const defLookup = {};
  for (const def of definitions) {
    defLookup[def.id] = def;
  }

  return [
    ...new Set(
      values
        .filter((v) => {
          const def = defLookup[v.output_definition_id];
          if (!def) return false;
          return def.resource_type === targetTypeNum && v.values?.detected;
        })
        .map((v) => v.resource_id)
    )
  ];
}

/**
 * Get unique patients from results.
 *
 * @param {Object} data - Results data
 * @returns {Array} Array of { mrn, csn } objects
 */
export function getUniquePatients(data) {
  if (!data) return [];

  const patients = new Map();
  const values = data.output_values || [];

  for (const v of values) {
    const mrn = v.metadata?.patient_id;
    const csn = v.metadata?.encounter_id;
    if (mrn) {
      const key = `${mrn}-${csn}`;
      if (!patients.has(key)) {
        patients.set(key, { mrn, csn });
      }
    }
  }

  return Array.from(patients.values());
}

/**
 * Count flags per patient/encounter.
 * Returns data suitable for a table display.
 *
 * @param {Object} data - Results data
 * @returns {Array} Array of { mrn, csn, flagCounts: { flagName: { detected, count } } }
 */
export function countFlagsPerEncounter(data) {
  if (!data) return [];

  const definitions = data.output_definitions || [];
  const values = data.output_values || [];

  // Build definition lookup
  const defLookup = {};
  for (const def of definitions) {
    defLookup[def.id] = def;
  }

  const counts = {};

  for (const v of values) {
    const mrn = v.metadata?.patient_id;
    const csn = v.metadata?.encounter_id;
    const def = defLookup[v.output_definition_id];
    if (!def || !mrn) continue;

    const key = `${mrn}-${csn}`;
    const flagName = def.name;

    if (!counts[key]) {
      counts[key] = {
        mrn,
        csn,
        flagCounts: {}
      };
    }

    if (!counts[key].flagCounts[flagName]) {
      counts[key].flagCounts[flagName] = { detected: false, count: 0 };
    }

    if (v.values?.detected) {
      counts[key].flagCounts[flagName].detected = true;
      counts[key].flagCounts[flagName].count += 1;
    }
  }

  return Object.values(counts);
}

/**
 * Get all unique flag names from results.
 *
 * @param {Object} data - Results data
 * @returns {Array} Array of unique flag names
 */
export function getUniqueFlagNames(data) {
  if (!data) return [];

  const definitions = data.output_definitions || [];
  return definitions.map((d) => d.name);
}

/**
 * Calculate total detected flags count.
 *
 * @param {Object} data - Results data
 * @returns {number} Total count of detected flags
 */
export function getTotalDetectedCount(data) {
  if (!data) return 0;

  const values = data.output_values || [];
  return values.filter((v) => v.values?.detected).length;
}
