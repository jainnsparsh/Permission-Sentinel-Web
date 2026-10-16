"""
Permission Sentinel - APK Parser
Uses Androguard to extract permissions and metadata from APK files.
Isolated behind a service boundary. Falls back gracefully if Androguard is not installed.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

import struct
import zipfile

ANDROGUARD_AVAILABLE = False
try:
    try:
        from androguard.core.apk import APK              # Androguard 4.x
    except ImportError:
        from androguard.core.bytecodes.apk import APK    # Androguard 3.x
    ANDROGUARD_AVAILABLE = True
    try:
        from loguru import logger as _loguru
        _loguru.disable("androguard")                    # silence very verbose debug logs
    except Exception:
        pass
except Exception:  # ImportError, or a broken native dependency on newer Python versions
    logger.info(
        "Androguard not available; using the built-in APK reader "
        "(permissions, package and SDK info are still extracted)."
    )

MAX_MANIFEST_BYTES = 20 * 1024 * 1024   # guard against zip bombs


class APKParseError(Exception):
    """Raised when APK parsing fails."""
    pass


class APKParseResult:
    """Result of parsing an APK file."""
    def __init__(self):
        self.package_name: str = ""
        self.app_name: str = ""
        self.version_name: str = ""
        self.version_code: str = ""
        self.target_sdk: str = ""
        self.min_sdk: str = ""
        self.permissions: list[str] = []
        self.has_foreground_service: bool = False
        self.parse_warnings: list[str] = []
        self.engine: str = ""


def is_available() -> bool:
    """APK parsing is always available: the built-in reader needs no extra packages."""
    return True


def validate_apk_file(file_path: str, max_size_bytes: int) -> None:
    """
    Validate an APK file before parsing.
    
    Checks:
    - File exists
    - File size within limits
    - Basic file signature (PK zip header)
    """
    if not os.path.exists(file_path):
        raise APKParseError("APK file not found.")
    
    file_size = os.path.getsize(file_path)
    if file_size > max_size_bytes:
        raise APKParseError(
            f"APK file size ({file_size / (1024*1024):.1f} MB) exceeds the maximum "
            f"allowed size ({max_size_bytes / (1024*1024):.0f} MB)."
        )
    
    if file_size < 100:
        raise APKParseError("File is too small to be a valid APK.")
    
    # Check ZIP/PK signature
    with open(file_path, 'rb') as f:
        header = f.read(4)
    
    if header[:2] != b'PK':
        raise APKParseError(
            "Invalid APK file: missing ZIP signature. "
            "APK files are ZIP archives and must start with the PK header."
        )


def _read_string_pool(d: bytes, off: int):
    """Decode an AXML string pool chunk starting at `off`."""
    hdr = struct.unpack_from("<HHI", d, off)[1]
    count, _styles, flags, strings_start = struct.unpack_from("<IIII", d, off + 8)
    utf8 = bool(flags & 0x100)
    offsets = struct.unpack_from(f"<{count}I", d, off + hdr)
    base = off + strings_start
    out = []
    for o in offsets:
        p = base + o
        try:
            if utf8:
                n = d[p]; p += 1
                if n & 0x80: n = ((n & 0x7F) << 8) | d[p]; p += 1
                b = d[p]; p += 1
                if b & 0x80: b = ((b & 0x7F) << 8) | d[p]; p += 1
                out.append(d[p:p + b].decode("utf-8", "replace"))
            else:
                n = struct.unpack_from("<H", d, p)[0]; p += 2
                if n & 0x8000: n = ((n & 0x7FFF) << 16) | struct.unpack_from("<H", d, p)[0]; p += 2
                out.append(d[p:p + n * 2].decode("utf-16-le", "replace"))
        except Exception:
            out.append("")
    return out


def _decode_manifest(d: bytes) -> dict:
    """Minimal Android binary XML (AXML) reader: pulls out what permission analysis needs."""
    if len(d) < 8 or struct.unpack_from("<H", d, 0)[0] != 0x0003:
        raise APKParseError("AndroidManifest.xml is not valid Android binary XML.")
    total = min(struct.unpack_from("<I", d, 4)[0], len(d))
    strings, pos = [], 8
    info = {"package": "", "version_name": "", "version_code": "", "min_sdk": "", "target_sdk": "",
            "label": "", "permissions": set(), "foreground": False}

    def sval(i):
        return strings[i] if 0 <= i < len(strings) else ""

    while pos + 8 <= total:
        ctype, chdr, csize = struct.unpack_from("<HHI", d, pos)
        if csize < 8:
            break
        if ctype == 0x0001:
            strings = _read_string_pool(d, pos)
        elif ctype == 0x0102:  # START_TAG
            name_i = struct.unpack_from("<i", d, pos + 20)[0]
            attr_start, attr_size, attr_count = struct.unpack_from("<HHH", d, pos + 24)
            tag, attrs = sval(name_i), {}
            for k in range(attr_count):
                a = pos + 16 + attr_start + k * (attr_size or 20)
                _ns, an, raw, _sz, _r0, dtype, data = struct.unpack_from("<iiiHBBI", d, a)
                if dtype == 0x03: v = sval(raw)                 # string
                elif dtype == 0x10: v = str(data)               # int
                elif dtype == 0x12: v = "true" if data else "false"
                elif dtype == 0x01: v = f"@{data:08x}"          # resource reference
                else: v = sval(raw) or str(data)
                attrs[sval(an)] = v
            if tag == "manifest":
                info["package"] = attrs.get("package", "")
                info["version_name"] = attrs.get("versionName", "")
                info["version_code"] = attrs.get("versionCode", "")
            elif tag == "uses-sdk":
                info["min_sdk"] = attrs.get("minSdkVersion", "")
                info["target_sdk"] = attrs.get("targetSdkVersion", "")
            elif tag in ("uses-permission", "uses-permission-sdk-23", "uses-permission-sdk-m") and attrs.get("name"):
                info["permissions"].add(attrs["name"].strip())
            elif tag == "application" and attrs.get("label") and not attrs["label"].startswith("@"):
                info["label"] = attrs["label"]
            elif tag == "service" and attrs.get("foregroundServiceType"):
                info["foreground"] = True
        pos += csize
    if not strings:
        raise APKParseError("Could not read the manifest string table (file may be corrupted or obfuscated).")
    if "android.permission.FOREGROUND_SERVICE" in info["permissions"]:
        info["foreground"] = True
    return info


def _parse_builtin(file_path: str) -> APKParseResult:
    """Dependency-free APK reader: APK = ZIP containing a binary AndroidManifest.xml."""
    try:
        with zipfile.ZipFile(file_path) as z:
            try:
                zi = z.getinfo("AndroidManifest.xml")
            except KeyError:
                raise APKParseError("Not an APK: AndroidManifest.xml was not found inside the archive.")
            if zi.file_size > MAX_MANIFEST_BYTES:
                raise APKParseError("AndroidManifest.xml is unreasonably large; refusing to parse.")
            raw = z.read(zi)
    except zipfile.BadZipFile:
        raise APKParseError("The file is not a valid ZIP/APK archive.")
    # Hand-made / test APKs often hold a plain-text manifest instead of compiled binary XML.
    if raw.lstrip(b"\xef\xbb\xbf \t\r\n")[:1] == b"<":
        from app.parsers.manifest_parser import parse_manifest_xml
        m = parse_manifest_xml(raw.decode("utf-8", "replace"))
        r = APKParseResult()
        r.engine = "builtin-text-manifest"
        r.package_name, r.app_name = m.package_name or "", m.app_name or ""
        r.version_name, r.version_code = m.version_name or "", str(m.version_code or "")
        r.target_sdk, r.min_sdk = str(m.target_sdk or ""), str(m.min_sdk or "")
        r.permissions = sorted(set(m.permissions))
        r.has_foreground_service = bool(m.has_foreground_service)
        r.parse_warnings = list(m.parse_warnings)
        return r
    info = _decode_manifest(raw)
    r = APKParseResult()
    r.engine = "builtin"
    r.package_name, r.app_name = info["package"], info["label"]
    r.version_name, r.version_code = info["version_name"], info["version_code"]
    r.target_sdk, r.min_sdk = info["target_sdk"], info["min_sdk"]
    r.permissions = sorted(info["permissions"])
    r.has_foreground_service = info["foreground"]
    if not info["label"]:
        r.parse_warnings.append("App display name is stored as a resource reference; package name is used instead.")
    return r


def parse_apk(file_path: str, max_size_bytes: int) -> APKParseResult:
    """
    Parse an APK and extract permissions and metadata.
    Uses Androguard when installed and working, otherwise the built-in reader.
    """
    validate_apk_file(file_path, max_size_bytes)

    if ANDROGUARD_AVAILABLE:
        try:
            apk = APK(file_path)
            if apk.is_valid_APK():
                result = APKParseResult()
                result.engine = "androguard"
                result.package_name = apk.get_package() or ""
                result.app_name = apk.get_app_name() or ""
                result.version_name = apk.get_androidversion_name() or ""
                result.version_code = apk.get_androidversion_code() or ""
                result.target_sdk = apk.get_target_sdk_version() or ""
                result.min_sdk = apk.get_min_sdk_version() or ""
                result.permissions = sorted({p.strip() for p in apk.get_permissions() if p and p.strip()})
                try:
                    result.has_foreground_service = (
                        "android.permission.FOREGROUND_SERVICE" in result.permissions)
                except Exception:
                    pass
                if not result.permissions:
                    result.parse_warnings.append("No permissions found in the APK. The app may not require any permissions.")
                return result
        except Exception as e:
            logger.warning("Androguard failed (%s); falling back to the built-in APK reader.", e)

    result = _parse_builtin(file_path)
    if not result.permissions:
        result.parse_warnings.append("No permissions found in the APK. The app may not require any permissions.")
    return result
