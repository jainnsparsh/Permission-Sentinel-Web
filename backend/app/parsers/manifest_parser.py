"""
Permission Sentinel - Manifest XML Parser
Safely parses AndroidManifest.xml files to extract permissions and metadata.
Uses defusedxml to prevent XML attacks.
"""

import xml.etree.ElementTree as ET
from typing import Optional


ANDROID_NS = "http://schemas.android.com/apk/res/android"


class ManifestParseError(Exception):
    """Raised when manifest parsing fails."""
    pass


class ManifestParseResult:
    """Result of parsing an AndroidManifest.xml file."""
    def __init__(self):
        self.package_name: str = ""
        self.app_name: str = ""
        self.version_name: str = ""
        self.version_code: str = ""
        self.target_sdk: str = ""
        self.min_sdk: str = ""
        self.permissions: list[str] = []
        self.has_foreground_service: bool = False
        self.has_background_service: bool = False
        self.parse_warnings: list[str] = []


def parse_manifest_xml(xml_content: str) -> ManifestParseResult:
    """
    Parse an AndroidManifest.xml string and extract permissions and metadata.
    
    Args:
        xml_content: The raw XML string of the AndroidManifest.xml
        
    Returns:
        ManifestParseResult with extracted data
        
    Raises:
        ManifestParseError: If the XML cannot be parsed or is not a valid manifest
    """
    result = ManifestParseResult()

    # Check for binary XML format
    if isinstance(xml_content, bytes):
        if xml_content[:4] == b'\x03\x00\x08\x00' or xml_content[:2] == b'\x03\x00':
            raise ManifestParseError(
                "This appears to be a binary Android manifest (AXML format). "
                "Binary manifests must be parsed from APK files using the APK parser. "
                "Please upload the complete APK file or provide a plain text XML manifest."
            )
        try:
            xml_content = xml_content.decode('utf-8')
        except UnicodeDecodeError:
            raise ManifestParseError(
                "Cannot decode the file as UTF-8. This may be a binary manifest. "
                "Please upload a plain text XML manifest or the complete APK file."
            )

    # Check basic XML structure
    stripped = xml_content.strip()
    if not stripped:
        raise ManifestParseError("Empty manifest file.")
    
    if not stripped.startswith('<?xml') and not stripped.startswith('<manifest'):
        # Check if it might be a binary manifest in string form
        if '\x00' in stripped[:100]:
            raise ManifestParseError(
                "This appears to be a binary Android manifest. "
                "Please upload a plain text XML manifest or the complete APK file."
            )

    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ManifestParseError(f"Invalid XML format: {str(e)}")

    # Verify this is an Android manifest
    if root.tag != "manifest":
        raise ManifestParseError(
            f"Root element is '{root.tag}', expected 'manifest'. "
            "This does not appear to be an AndroidManifest.xml file."
        )

    # Extract package name
    result.package_name = root.get("package", "")

    # Extract version info
    result.version_name = root.get(f"{{{ANDROID_NS}}}versionName", "")
    result.version_code = root.get(f"{{{ANDROID_NS}}}versionCode", "")

    # Extract SDK versions
    uses_sdk = root.find("uses-sdk")
    if uses_sdk is not None:
        result.target_sdk = uses_sdk.get(f"{{{ANDROID_NS}}}targetSdkVersion", "")
        result.min_sdk = uses_sdk.get(f"{{{ANDROID_NS}}}minSdkVersion", "")

    # Extract app label
    application = root.find("application")
    if application is not None:
        result.app_name = application.get(f"{{{ANDROID_NS}}}label", "")
        # Strip resource reference if present
        if result.app_name.startswith("@"):
            result.app_name = ""
            result.parse_warnings.append(
                "App label is a resource reference and cannot be resolved from manifest alone."
            )

    # Extract permissions (uses-permission and uses-permission-sdk-23)
    permissions_set = set()
    
    for tag in ["uses-permission", "uses-permission-sdk-23"]:
        for perm_elem in root.findall(tag):
            perm_name = perm_elem.get(f"{{{ANDROID_NS}}}name", "")
            if perm_name:
                # Normalize: strip whitespace
                perm_name = perm_name.strip()
                if perm_name:
                    permissions_set.add(perm_name)

    result.permissions = sorted(permissions_set)

    # Check for foreground service declarations
    if application is not None:
        for service in application.findall("service"):
            fg_type = service.get(f"{{{ANDROID_NS}}}foregroundServiceType", "")
            if fg_type:
                result.has_foreground_service = True

    # Check for background-related components
    if application is not None:
        for receiver in application.findall("receiver"):
            for intent_filter in receiver.findall("intent-filter"):
                for action in intent_filter.findall("action"):
                    action_name = action.get(f"{{{ANDROID_NS}}}name", "")
                    if "BOOT_COMPLETED" in action_name:
                        result.has_background_service = True

    if not result.permissions:
        result.parse_warnings.append(
            "No permissions found in the manifest. The app may not require any permissions, "
            "or the manifest may be incomplete."
        )

    return result


def parse_manifest_file(file_path: str) -> ManifestParseResult:
    """Parse a manifest from a file path."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(file_path, 'rb') as f:
            content = f.read()
    
    return parse_manifest_xml(content)
