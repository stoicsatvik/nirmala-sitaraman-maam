import json
import tempfile
import unittest
from pathlib import Path
from e488_snapshot_integrity import audit, audit_file


def rec(key, state, ref="TENDER-123", sensor="s", **overrides):
    return dict(sensorId=sensor, externalKey=key, state=state, tenderReference=ref,
                authority="Agency", jurisdiction="India", fiscalYear="2026-27", **overrides)


def snapshot(records, links=()):
    return dict(generatedAt="2026-11-01T20:29:11.895Z", sensors=[dict(ok=True)],
                records=records, links=list(links), summary=dict(sensors=1, healthySensors=1,
                records=len(records), reconciledLinks=len(links)))


def link(a="a", b="b", relation="shared_tender_reference", reference="TENDER-123"):
    return dict(fromExternalKey=a, toExternalKey=b, relation=relation,
                basis="exact_tender_reference", confidence=1, reference=reference)


class E488Tests(unittest.TestCase):
    def test_conservative_exact_coreference_is_admissible(self):
        r = audit(snapshot([rec("a", "procured"), rec("b", "paid")], [link()]))
        self.assertTrue(r["publication_integrity_pass"])
        self.assertEqual(r["unsupported_link_count"], 0)

    def test_same_state_is_not_money_progression(self):
        r = audit(snapshot([rec("a", "procured"), rec("b", "procured")], [link(relation="procured → procured")]))
        self.assertEqual(r["unsupported_link_count"], 1)
        self.assertIn("same_state_not_progression", r["unsupported_links"][0]["reasons"])
        self.assertIn("unsupported_causal_direction", r["unsupported_links"][0]["reasons"])

    def test_markup_reference_rejected(self):
        bad = '<a href="login">CAPTCHA</a>'
        r = audit(snapshot([rec("a", "procured", ref=bad), rec("b", "paid", ref=bad)], [link(reference=bad)]))
        self.assertEqual(r["markup_tender_reference_records"], 2)
        self.assertIn("markup_as_reference", r["unsupported_links"][0]["reasons"])

    def test_duplicate_identity_rejected(self):
        r = audit(snapshot([rec("a", "procured"), rec("a", "procured"), rec("b", "paid")], [link()]))
        self.assertEqual(r["duplicate_key_groups"], 1)
        self.assertIn("endpoint_identity_missing_or_ambiguous", r["unsupported_links"][0]["reasons"])

    def test_missing_context_rejected(self):
        r1=rec("a", "procured")
        r2=rec("b", "paid")
        r2["authority"]="Other Agency"
        r = audit(snapshot([r1,r2], [link()]))
        self.assertIn("incomplete_or_mismatched_context", r["unsupported_links"][0]["reasons"])

    def test_mismatched_reference_rejected(self):
        r = audit(snapshot([rec("a", "procured"), rec("b", "paid", ref="OTHER-999")], [link()]))
        self.assertIn("reference_mismatch", r["unsupported_links"][0]["reasons"])

    def test_summary_mismatch_is_flagged(self):
        s = snapshot([rec("a", "procured")]);s["summary"]["records"]=99
        self.assertEqual(audit(s)["summary_mismatches"]["records"]["actual"], 1)

    def test_malformed_snapshot_fails_closed(self):
        with self.assertRaises(ValueError):audit({"records": [], "links": [], "sensors": [], "summary": None})

    def test_byte_pinned_receipt(self):
        s = snapshot([rec("a", "procured")])
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"sample.json";p.write_text(json.dumps(s))
            self.assertEqual(len(audit_file(p)["input_git_blob_sha1"]), 40)


if __name__ == '__main__':unittest.main()
