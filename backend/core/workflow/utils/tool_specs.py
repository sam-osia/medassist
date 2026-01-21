"""Tool specification helpers for workflow agents."""

from typing import Dict, Any, List

from core.workflow.tools.notes import (
    GetPatientNotesIds,
    ReadPatientNote,
    SummarizePatientNote,
    HighlightPatientNote,
    AnalyzeNoteWithSpanAndReason,
)
from core.workflow.tools.flowsheets import (
    ReadFlowsheetsTable,
    SummarizeFlowsheetsTable,
)
from core.workflow.tools.medications import (
    GetMedicationsIds,
    ReadMedication,
    HighlightMedication,
    FilterMedication,
)
from core.workflow.tools.diagnosis import (
    GetDiagnosisIds,
    ReadDiagnosis,
    HighlightDiagnosis,
)


def get_tools_list(dataset: str = None) -> List:
    """Initialize tools with dataset context."""
    return [
        GetPatientNotesIds(dataset=dataset),
        ReadPatientNote(dataset=dataset),
        SummarizePatientNote(),
        HighlightPatientNote(),
        AnalyzeNoteWithSpanAndReason(),
        ReadFlowsheetsTable(dataset=dataset),
        SummarizeFlowsheetsTable(),
        GetMedicationsIds(dataset=dataset),
        ReadMedication(dataset=dataset),
        HighlightMedication(),
        FilterMedication(dataset=dataset),
        GetDiagnosisIds(dataset=dataset),
        ReadDiagnosis(dataset=dataset),
        HighlightDiagnosis(),
    ]


def get_tool_specs_for_agents(dataset: str = None) -> Dict[str, Any]:
    """
    Build tool specifications dict for generator/editor agents.

    Returns a dict mapping tool names to their specs:
    {
        "tool_name": {
            "description": "...",
            "parameters": {...},
            "returns": {...}
        }
    }
    """
    tools = get_tools_list(dataset)
    specs = {}

    for tool in tools:
        specs[tool.name] = {
            "description": tool.description,
            "parameters": tool.parameters,
            "returns": tool.returns,
        }

        # Add category if available
        if hasattr(tool, 'category'):
            specs[tool.name]["category"] = tool.category

    return specs


def get_tool_names(dataset: str = None) -> List[str]:
    """Get list of available tool names."""
    tools = get_tools_list(dataset)
    return [tool.name for tool in tools]


def get_tools_by_category(dataset: str = None) -> Dict[str, List[str]]:
    """Group tool names by category."""
    tools = get_tools_list(dataset)
    by_category: Dict[str, List[str]] = {}

    for tool in tools:
        category = getattr(tool, 'category', 'other')
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(tool.name)

    return by_category
