import copy
import unittest
from compare import compare, load, summarize


class RegressionTests(unittest.TestCase):
    def setUp(self):
        self.data = load("cases.json")
        self.base = load("baseline.json")

    def test_demonstration_detects_regression(self):
        report = compare(self.data, self.base, load("candidate.json"))
        self.assertEqual(report["gate"], "FAIL")
        self.assertEqual(report["candidate"]["matched"], 10)
        self.assertEqual(report["candidate"]["unsafe_pass"], 1)
        self.assertEqual(report["candidate"]["unclear"], 1)

    def test_unchanged_passes(self):
        self.assertEqual(compare(self.data, self.base, self.base)["gate"], "PASS")

    def test_bad_identity_and_version_are_rejected(self):
        for mutation in ("missing", "duplicate", "version"):
            changed = copy.deepcopy(self.base)
            if mutation == "missing":
                changed["results"].pop()
            elif mutation == "duplicate":
                changed["results"][1] = changed["results"][0]
            else:
                changed["rubric_version"] = "different"
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                summarize(self.data, changed)

    def test_execution_error_keeps_denominator_and_blocks_gate(self):
        changed = copy.deepcopy(self.base)
        changed["results"][0] = {"id": "complete", "status": "error", "error": "timeout"}
        report = compare(self.data, self.base, changed)
        self.assertEqual(report["candidate"]["total"], 12)
        self.assertEqual(report["candidate"]["matched"], 9)
        self.assertEqual(report["candidate"]["execution_errors"], 1)
        self.assertEqual(report["gate"], "FAIL")


if __name__ == "__main__":
    unittest.main()
