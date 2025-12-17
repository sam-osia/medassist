from __future__ import annotations

import json
import pickle
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, Tag


_REF_META_RE = re.compile(r"^url=", re.IGNORECASE)


def _resolve_document(path: Path, visited: set[Path] | None = None) -> tuple[BeautifulSoup, Path]:
    """Load the first HTML document that actually contains content.

    Some exports ship a stub page that immediately redirects via a meta refresh.
    We follow the redirect (if the target exists locally) so the parser can
    inspect the real navigation markup.
    """

    if visited is None:
        visited = set()

    path = path.resolve()

    if path in visited:
        raise RuntimeError(f"Detected redirect loop while resolving {path}")

    if not path.is_file():
        raise FileNotFoundError(f"HTML file not found: {path}")

    visited.add(path)

    html = path.read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")

    meta = soup.find("meta", attrs={"http-equiv": lambda value: value and value.lower() == "refresh"})
    if not meta:
        return soup, path

    target = _extract_refresh_target(meta.get("content", ""))
    if not target:
        return soup, path

    next_path = (path.parent / target).resolve()
    if not next_path.exists():
        # Fall back to the current soup if the redirect target is missing.
        return soup, path

    return _resolve_document(next_path, visited)


def _extract_refresh_target(content: str) -> str | None:
    if not content:
        return None

    for part in content.split(";"):
        part = part.strip()
        if _REF_META_RE.match(part):
            value = part.split("=", 1)[1].strip().strip("'\"")
            return value
    return None


def _build_index(soup: BeautifulSoup) -> dict[str, list[str]]:
    tables: dict[str, list[str]] = OrderedDict()

    for entry in soup.select("li[data-table-name]"):
        table_name = (entry.get("data-table-name") or "").strip()
        if not table_name:
            continue

        parent_name = (entry.get("data-parent-name") or "").strip()
        if not parent_name:
            tables.setdefault(table_name, [])
            continue

        children = tables.setdefault(parent_name, [])
        if table_name not in children:
            children.append(table_name)

    return tables


def _normalize_definition_value(dd: Tag) -> Any:
    list_container = dd.find("ol")
    if list_container:
        items = [item.get_text(strip=True) for item in list_container.find_all("li")]
        return items

    strings = [text.strip() for text in dd.stripped_strings]
    if not strings:
        return None

    value = " ".join(strings)
    if value.lower() == "none":
        return []

    return value


def _parse_definition_list(dl: Tag | None) -> dict[str, Any]:
    if dl is None:
        return {}

    result: dict[str, Any] = OrderedDict()
    current_key: str | None = None

    for child in dl.find_all(["dt", "dd"], recursive=False):
        if child.name == "dt":
            current_key = child.get_text(strip=True)
        elif current_key is not None:
            value = _normalize_definition_value(child)
            if current_key in result:
                existing = result[current_key]
                if isinstance(existing, list):
                    existing.append(value)
                else:
                    result[current_key] = [existing, value]
            else:
                result[current_key] = value

    return dict(result)


def _parse_description(article: Tag | None) -> list[str]:
    if article is None:
        return []

    description_container = article.find("div", class_="description")
    if not description_container:
        return []

    paragraphs = [
        " ".join(p.stripped_strings)
        for p in description_container.find_all("p")
        if p.get_text(strip=True)
    ]

    if paragraphs:
        return paragraphs

    text = " ".join(description_container.stripped_strings)
    return [text] if text else []


def _parse_columns(article: Tag | None) -> list[dict[str, Any]]:
    if article is None:
        return []

    columns_section = article.find("section", class_="columns")
    if not columns_section:
        return []

    columns: list[dict[str, Any]] = []
    for column_node in columns_section.select("section.column.outer-section"):
        column_name = (
            column_node.get("data-column-name")
            or column_node.get("id")
        )

        if not column_name:
            name_node = column_node.find("h1", class_="column-name")
            column_name = name_node.get_text(strip=True) if name_node else ""

        column_type_node = column_node.find("span", class_="column-type")
        raw_column_type: str | None = None
        if column_type_node:
            raw_column_type = column_type_node.get_text(strip=True)
            if raw_column_type.startswith(":"):
                raw_column_type = raw_column_type[1:].strip()

        description_node = column_node.find("div", class_="column-description")
        description = (
            " ".join(description_node.stripped_strings)
            if description_node
            else None
        )

        properties_node = column_node.find("dl", class_="column-properties")
        properties = _parse_definition_list(properties_node)

        data_type = properties.get("Data type") or raw_column_type
        sql_data_type = properties.get("SQL Server data type")

        references_node = column_node.select_one("div.right em")
        references = (
            [anchor.get_text(strip=True) for anchor in references_node.find_all("a")]
            if references_node
            else []
        )

        column_info: dict[str, Any] = {
            "name": column_name,
            "definition": description,
            "data_type": data_type,
            "sql_data_type": sql_data_type,
            "properties": properties,
        }

        if references:
            column_info["references"] = references

        columns.append(column_info)

    return columns


def _extract_table_details(table_name: str, tables_dir: Path) -> dict[str, Any]:
    table_path = (tables_dir / f"{table_name}.html").resolve()
    if not table_path.is_file():
        raise FileNotFoundError(f"Table HTML not found for {table_name}: {table_path}")

    soup, _ = _resolve_document(table_path)
    article = soup.find("article", attrs={"data-table-name": table_name})
    if article is None:
        article = soup.find("article", class_="table")

    description_lines = _parse_description(article)

    properties_section = article.find("section", class_="properties") if article else None
    properties = _parse_definition_list(
        properties_section.find("dl") if properties_section else None
    )

    return {
        "definition": description_lines[0] if description_lines else None,
        "description": description_lines,
        "properties": properties,
        "columns": _parse_columns(article),
    }


def _collect_table_names(navigation: dict[str, list[str]]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()

    for parent, children in navigation.items():
        if parent not in seen:
            ordered.append(parent)
            seen.add(parent)

        for child in children:
            if child not in seen:
                ordered.append(child)
                seen.add(child)

    return ordered


def _load_navigation(html_filename: str | Path | None) -> tuple[dict[str, list[str]], Path]:
    base_dir = Path(__file__).resolve().parent

    if html_filename is None:
        candidate = base_dir / "Caboodle Dictionary/index.html"
    else:
        html_path = Path(html_filename)
        candidate = html_path if html_path.is_absolute() else base_dir / html_path

    soup, resolved_path = _resolve_document(candidate)
    navigation = _build_index(soup)

    tables_dir = resolved_path.parent
    if tables_dir.name.lower() != "tables":
        potential = tables_dir / "tables"
        if potential.is_dir():
            tables_dir = potential

    return navigation, tables_dir


def extract_tables(html_filename: str | Path | None = None) -> dict[str, list[str]]:
    """Return a mapping of table names to their subtables."""

    navigation, _ = _load_navigation(html_filename)
    return navigation


def extract_dictionary(html_filename: str | Path | None = None) -> dict[str, dict[str, Any]]:
    """Return detailed metadata for each Caboodle table.

    The result maps table names (parents and children) to a dictionary with
    their direct children and the parsed details from the corresponding table
    page (description, properties, columns, etc.).
    """

    navigation, tables_dir = _load_navigation(html_filename)
    table_order = _collect_table_names(navigation)
    cache: dict[str, dict[str, Any]] = {}

    def _details(table_name: str) -> dict[str, Any]:
        if table_name not in cache:
            try:
                cache[table_name] = _extract_table_details(table_name, tables_dir)
            except FileNotFoundError:
                cache[table_name] = {}
        return cache[table_name]

    full_index: dict[str, dict[str, Any]] = OrderedDict()

    for name in table_order:
        details = _details(name)
        columns = details.get("columns", []) if details else []

        variables: OrderedDict[str, dict[str, Any]] = OrderedDict()
        for column in columns:
            column_name = column.get("name")
            if not column_name:
                continue

            variables[column_name] = {
                "definition": column.get("definition"),
                "properties": column.get("properties", {}),
            }

        full_index[name] = {
            "definition": details.get("definition") if details else None,
            "properties": details.get("properties") if details else {},
            "children": navigation.get(name, []),
            "variables": variables,
            "details": details,
        }

    return full_index


def dump_dictionary_to_json(
    output_path: str | Path | None = None,
    *,
    html_filename: str | Path | None = None,
    include_details: bool = False,
    dictionary: dict[str, dict[str, Any]] | None = None,
) -> Path:
    """Write the Caboodle dictionary metadata to a JSON file."""

    if dictionary is not None and html_filename is not None:
        raise ValueError("Provide either 'dictionary' or 'html_filename', not both")

    base_dir = Path(__file__).resolve().parent
    if output_path is None:
        resolved_output = base_dir / "caboodle_dictionary.json"
    else:
        output_path = Path(output_path)
        resolved_output = output_path if output_path.is_absolute() else base_dir / output_path

    source = dictionary or extract_dictionary(html_filename)

    data_to_write: OrderedDict[str, dict[str, Any]] = OrderedDict()
    for name, payload in source.items():
        entry = dict(payload)
        if not include_details:
            entry.pop("details", None)
        data_to_write[name] = entry

    resolved_output.write_text(
        json.dumps(data_to_write, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return resolved_output


def dump_dictionary_to_pickle(
    output_path: str | Path | None = None,
    *,
    html_filename: str | Path | None = None,
    include_details: bool = False,
    dictionary: dict[str, dict[str, Any]] | None = None,
    protocol: int | None = None,
) -> Path:
    """Write the Caboodle dictionary metadata to a pickle file."""

    if dictionary is not None and html_filename is not None:
        raise ValueError("Provide either 'dictionary' or 'html_filename', not both")

    base_dir = Path(__file__).resolve().parent
    if output_path is None:
        resolved_output = base_dir / "caboodle_dictionary.pkl"
    else:
        output_path = Path(output_path)
        resolved_output = output_path if output_path.is_absolute() else base_dir / output_path

    source = dictionary or extract_dictionary(html_filename)

    data_to_write: OrderedDict[str, dict[str, Any]] = OrderedDict()
    for name, payload in source.items():
        entry = dict(payload)
        if not include_details:
            entry.pop("details", None)
        data_to_write[name] = entry

    resolved_output.write_bytes(
        pickle.dumps(data_to_write, protocol=protocol if protocol is not None else pickle.HIGHEST_PROTOCOL)
    )

    return resolved_output


if __name__ == "__main__":
    dictionary = extract_dictionary()
    json_file = dump_dictionary_to_json(dictionary=dictionary)
    pickle_file = dump_dictionary_to_pickle(dictionary=dictionary)
    print(f"Caboodle dictionary written to {json_file}")
    print(f"Caboodle dictionary pickle written to {pickle_file}")
