"""E488: read-only public-ledger snapshot integrity gate.

No network calls, database writes, or inference about wrongdoing. A matching
reference is NOT evidence that money moved between records.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from hashlib import sha1, sha256
from pathlib import Path
import argparse
import json
import re

MARKUP = re.compile(r"<\s*/?\s*[a-z][^>]*>|javascript|captcha|document\s*\.\s*getelementbyid|function\s*\(", re.I)


def normalize(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "")).upper()


def audit(snapshot: dict) -> dict:
    records = snapshot.get("records")
    links = snapshot.get("links")
    sensors = snapshot.get("sensors")
    summary = snapshot.get("summary")
    if not isinstance(records, list) or not isinstance(links, list) or not isinstance(sensors, list) or not isinstance(summary, dict):
        raise ValueError("snapshot lacks records, links, sensors or summary")
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_external: dict[str, list[dict]] = defaultdict(list)
    markup_records = []
    for r in records:
        if not isinstance(r, dict):
            raise ValueError("non-object record")
        key = (str(r.get("sensorId", "")), str(r.get("externalKey", "")))
        groups[key].append(r)
        by_external[key[1]].append(r)
        if MARKUP.search(str(r.get("tenderReference") or "")):
            markup_records.append(key)
    duplicate_keys = sorted([key for key, group in groups.items() if len(group) > 1])
    bad_links = []
    for index, link in enumerate(links):
        reasons = []
        if not isinstance(link, dict):
            bad_links.append({"index": index, "reasons": ["non_object_link"]})
            continue
        src, dst = by_external.get(link.get("fromExternalKey"), []), by_external.get(link.get("toExternalKey"), [])
        if len(src) != 1 or len(dst) != 1:
            reasons.append("endpoint_identity_missing_or_ambiguous")
        else:
            a, b = src[0], dst[0]
            if a.get("state") == b.get("state"):
                reasons.append("same_state_not_progression")
            if any(not a.get(field) or not b.get(field) or a[field] != b[field]
                   for field in ("authority", "jurisdiction", "fiscalYear")):
                reasons.append("incomplete_or_mismatched_context")
            if not (normalize(a.get("tenderReference")) == normalize(b.get("tenderReference")) == normalize(link.get("reference"))):
                reasons.append("reference_mismatch")
        if MARKUP.search(str(link.get("reference") or "")):
            reasons.append("markup_as_reference")
        if link.get("basis") == "exact_tender_reference" and link.get("relation") != "shared_tender_reference":
            reasons.append("unsupported_causal_direction")
        if reasons:
            bad_links.append({"index": index, "reasons": sorted(set(reasons))})
    expected = {"sensors": len(sensors), "records": len(records), "reconciledLinks": len(links),
                "healthySensors": sum(s.get("ok") is True for s in sensors)}
    mismatches = {k: {"reported": summary.get(k), "actual": v} for k, v in expected.items() if summary.get(k) != v}
    return {
        "schema": "public-ledger/e488/snapshot-integrity/v1",
        "generated_at": snapshot.get("generatedAt"),
        "record_count": len(records),
        "distinct_sensor_external_keys": len(groups),
        "duplicate_key_groups": len(duplicate_keys),
        "duplicate_keys": [{"sensor_id": k[0], "external_key": k[1]} for k in duplicate_keys],
        "markup_tender_reference_records": len(markup_records),
        "link_count": len(links),
        "unsupported_link_count": len(bad_links),
        "unsupported_links": bad_links,
        "summary_mismatches": mismatches,
        "publication_integrity_pass": not (duplicate_keys or markup_records or bad_links or mismatches),
        "claim": "Read-only integrity audit; violations do not imply public-money wrongdoing or actual financial transfers",
    }


def audit_file(path: Path) -> dict:
    raw = path.read_bytes()
    result = audit(json.loads(raw))
    result["input_sha256"] = sha256(raw).hexdigest()
    result["input_git_blob_sha1"] = sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=Path)
    args = parser.parse_args()
    print(json.dumps(audit_file(args.snapshot), indent=2, sort_keys=True))
