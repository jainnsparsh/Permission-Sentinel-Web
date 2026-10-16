"""
Permission Sentinel - Report Parser
Parses JSON and CSV permission reports into normalized app records.
"""

import json
import csv
import io
from typing import Optional


class ReportParseError(Exception):
    """Raised when report parsing fails."""
    pass


class AppRecord:
    """Normalized app record from any input source."""
    def __init__(self):
        self.app_name: str = ""
        self.package_name: str = ""
        self.purpose: str = ""
        self.purpose_source: str = "provided"
        self.permissions: list[str] = []
        self.description: Optional[str] = None
        self.version: Optional[str] = None
        self.target_sdk: Optional[str] = None
        self.source: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "app_name": self.app_name,
            "package_name": self.package_name,
            "purpose": self.purpose,
            "purpose_source": self.purpose_source,
            "permissions": self.permissions,
            "description": self.description,
            "version": self.version,
            "target_sdk": self.target_sdk,
            "source": self.source,
        }


def parse_json_report(content: str) -> list[AppRecord]:
    """
    Parse a JSON permission report.
    
    Expected format: Array of objects with fields:
    - app_name (required)
    - package_name (optional)
    - purpose/category (required)
    - description (optional)
    - permissions (required, array of strings)
    - source (optional)
    - version (optional)
    - target_sdk (optional)
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ReportParseError(f"Invalid JSON format: {str(e)}")

    if isinstance(data, dict):
        # Single record wrapped in object
        if "apps" in data:
            data = data["apps"]
        else:
            data = [data]
    
    if not isinstance(data, list):
        raise ReportParseError("JSON must be an array of app records or an object with an 'apps' array.")

    if not data:
        raise ReportParseError("JSON array is empty. Provide at least one app record.")

    records = []
    errors = []

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            errors.append(f"Record {i+1}: Expected an object, got {type(item).__name__}.")
            continue

        record = AppRecord()
        
        # App name (required)
        record.app_name = str(item.get("app_name", item.get("name", ""))).strip()
        if not record.app_name:
            errors.append(f"Record {i+1}: Missing required field 'app_name'.")
            continue

        # Package name
        record.package_name = str(item.get("package_name", item.get("package", ""))).strip()

        # Purpose (required)
        record.purpose = str(item.get("purpose", item.get("category", ""))).strip()
        if not record.purpose:
            errors.append(f"Record {i+1} ({record.app_name}): Missing required field 'purpose' or 'category'.")
            continue

        record.purpose_source = str(item.get("purpose_source", "provided")).strip()
        record.description = item.get("description")
        record.version = str(item.get("version", "")) or None
        record.target_sdk = str(item.get("target_sdk", "")) or None
        record.source = item.get("source")

        # Permissions (required)
        perms = item.get("permissions", [])
        if isinstance(perms, str):
            perms = [p.strip() for p in perms.split(";") if p.strip()]
        elif isinstance(perms, list):
            perms = [str(p).strip() for p in perms if str(p).strip()]
        else:
            errors.append(f"Record {i+1} ({record.app_name}): 'permissions' must be an array or semicolon-separated string.")
            continue

        record.permissions = sorted(set(perms))
        records.append(record)

    if errors and not records:
        raise ReportParseError("All records failed validation:\n" + "\n".join(errors))

    return records


def parse_csv_report(content: str) -> list[AppRecord]:
    """
    Parse a CSV permission report.
    
    Expected columns:
    - app_name (required)
    - package_name (optional)
    - purpose (required)
    - permissions (required, semicolon-separated)
    - description (optional)
    - version (optional)
    - target_sdk (optional)
    - source (optional)
    """
    try:
        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise ReportParseError("CSV file is empty or has no header row.")
    except csv.Error as e:
        raise ReportParseError(f"Invalid CSV format: {str(e)}")

    # Validate required columns
    fields_lower = {f.lower().strip(): f for f in reader.fieldnames}
    
    if "app_name" not in fields_lower:
        raise ReportParseError(
            f"Missing required column 'app_name'. Found columns: {', '.join(reader.fieldnames)}"
        )
    if "purpose" not in fields_lower and "category" not in fields_lower:
        raise ReportParseError(
            f"Missing required column 'purpose' or 'category'. Found columns: {', '.join(reader.fieldnames)}"
        )
    if "permissions" not in fields_lower and "permission" not in fields_lower:
        raise ReportParseError(
            f"Missing required column 'permissions' (or 'permission'). Found columns: {', '.join(reader.fieldnames)}"
        )

    perm_col = "permissions" if "permissions" in fields_lower else "permission"
    records_by_key = {}
    errors = []

    for i, row in enumerate(reader):
        # Normalize keys
        norm_row = {k.lower().strip(): v for k, v in row.items()}
        
        app_name = (norm_row.get("app_name", "") or "").strip()
        if not app_name:
            errors.append(f"Row {i+2}: Missing 'app_name'.")
            continue

        package_name = (norm_row.get("package_name", "") or "").strip()
        purpose = (norm_row.get("purpose", norm_row.get("category", "")) or "").strip()
        if not purpose:
            errors.append(f"Row {i+2} ({app_name}): Missing 'purpose'.")
            continue

        # Parse semicolon-separated permissions
        perms_str = (norm_row.get(perm_col, "") or "").strip()
        new_perms = [p.strip() for p in perms_str.split(";") if p.strip()] if perms_str else []

        key = (app_name, package_name)
        if key in records_by_key:
            records_by_key[key].permissions = sorted(set(records_by_key[key].permissions + new_perms))
        else:
            record = AppRecord()
            record.app_name = app_name
            record.package_name = package_name
            record.purpose = purpose
            record.purpose_source = "provided"
            record.description = norm_row.get("description")
            record.version = norm_row.get("version") or None
            record.target_sdk = norm_row.get("target_sdk") or None
            record.source = norm_row.get("source")
            record.permissions = sorted(set(new_perms))
            records_by_key[key] = record

    records = list(records_by_key.values())
    if errors and not records:
        raise ReportParseError("All rows failed validation:\n" + "\n".join(errors))

    return records
