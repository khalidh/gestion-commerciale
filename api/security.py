import hmac
import os
from typing import Dict


def _parse_pairs(raw_value: str) -> Dict[str, str]:
    pairs: Dict[str, str] = {}
    for entry in (raw_value or '').split(','):
        item = entry.strip()
        if not item or ':' not in item:
            continue
        name, value = item.split(':', 1)
        key = name.strip().upper()
        token = value.strip()
        if key and token:
            pairs[key] = token
    return pairs


def auth_required() -> bool:
    return os.getenv('API_AUTH_REQUIRED', 'true').lower() in ('1', 'true', 'yes', 'on')


def get_expected_token(role_name: str) -> str:
    expected = _parse_pairs(os.getenv('API_AUTH_TOKENS', ''))
    return expected.get((role_name or '').strip().upper(), '')


def constant_time_equals(left: str, right: str) -> bool:
    if not left or not right:
        return False
    return hmac.compare_digest(left, right)


def validate_role_token(role_name: str, token: str) -> bool:
    expected = get_expected_token(role_name)
    return constant_time_equals(token or '', expected)
