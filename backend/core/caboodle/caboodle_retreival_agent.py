import os
from openai import OpenAI
from pydantic import BaseModel
from typing import List, Dict, Any
import json

from core.caboodle.caboodle_service import get_full_dictionary

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
model_name = "gpt-4o-2024-11-20"

class CandidateTables(BaseModel):
    tables: List[str]

class SelectedVariables(BaseModel):
    variables: List[str]


def build_table_index(dictionary: Dict[str, Any]) -> Dict[str, str]:
    """Extract table names and definitions from the Caboodle dictionary."""
    index = {}
    for table_name, table_data in dictionary.items():
        definition = table_data.get('definition', 'No definition available')
        index[table_name] = definition

    return index


def get_candidate_tables(user_query: str) -> List[str]:
    """
    Stage 1: Get candidate tables from LLM based on user query.

    Args:
        user_query: The user's research question

    Returns:
        List of candidate table names
    """
    # Get dictionary and build index
    dictionary = get_full_dictionary()
    table_index = build_table_index(dictionary)

    # Split dictionary into N parts
    num_splits = 2
    items = list(table_index.items())
    chunk_size = len(items) // num_splits
    chunks = []

    for i in range(num_splits):
        start_idx = i * chunk_size
        end_idx = start_idx + chunk_size if i < num_splits - 1 else len(items)
        chunks.append(dict(items[start_idx:end_idx]))

    # Build system prompt
    system_prompt = """You are a medical data expert helping researchers find relevant tables in the Epic Caboodle data warehouse.

Given a user's research question and a list of available tables with their descriptions, select the most relevant tables that likely contain data to answer the question.

Return candidate tables that could be relevant, so they can be investigated further. It's better to be inclusive at this stage.

Note that due to prompt length, you do not have visibility into all the tables. It is possible that none of the tables you are looking at are relevant.
"""

    # Query each chunk
    all_candidates = []
    for idx, chunk in enumerate(chunks):
        user_prompt = json.dumps({
            "user_query": user_query,
            "available_tables": chunk
        }, indent=2)

        response = client.responses.parse(
            model=model_name,
            instructions=system_prompt,
            input=user_prompt,
            text_format=CandidateTables,
        )

        all_candidates.extend(response.output_parsed.tables)
        print(f"Part {idx + 1}: {len(response.output_parsed.tables)} tables")

    print(f"\n=== LLM Selected Candidate Tables ===")
    print(f"Total: {len(all_candidates)} tables")
    for table in all_candidates:
        print(f"  - {table}")
    print(f"===================================\n")

    return all_candidates


def evaluate_candidate_table(table_name: str, user_query: str) -> List[str]:
    """
    Stage 2: Evaluate a single table's variables based on user query.

    Args:
        table_name: Name of the table to evaluate
        user_query: The user's research question

    Returns:
        List of selected variable names
    """
    # Get full dictionary and table data
    dictionary = get_full_dictionary()

    if table_name not in dictionary:
        print(f"Warning: Table '{table_name}' not found in dictionary")
        return []

    table_data = dictionary[table_name]
    table_definition = table_data.get('definition', 'No definition available')
    variables = table_data.get('variables', {})

    if not variables:
        print(f"Warning: Table '{table_name}' has no variables")
        return []

    # Format variables for LLM
    variables_formatted = {}
    for var_name, var_data in variables.items():
        variables_formatted[var_name] = {
            "definition": var_data.get('definition', 'No definition'),
            "properties": var_data.get('properties', {})
        }

    # Build prompts
    system_prompt = """You are a medical data expert helping researchers identify relevant variables in Epic Caboodle tables.

Given a user's research question, a table name, table definition, and all variables in that table, select the specific variables that are most relevant to answering the research question.

Return the variable names that would be useful. Be selective but inclusive - include variables that might be relevant even if not directly asked for."""

    user_prompt = json.dumps({
        "user_query": user_query,
        "table_name": table_name,
        "table_definition": table_definition,
        "variables": variables_formatted
    }, indent=2)

    # Call LLM with structured output
    response = client.responses.parse(
        model=model_name,
        instructions=system_prompt,
        input=user_prompt,
        text_format=SelectedVariables,
    )

    selected_vars = response.output_parsed.variables

    # Print results
    print(f"\n--- Table: {table_name} ---")
    print(f"Selected {len(selected_vars)} variables:")
    for var in selected_vars:
        print(f"  - {var}")
    print()

    return selected_vars