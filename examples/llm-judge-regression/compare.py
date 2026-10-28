"""Offline comparison of synthetic judge verdicts; no model calls."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERDICTS = {"pass", "fail", "unclear"}


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def validate(dataset, run):
    for key in ("dataset_version", "rubric_version"):
        if run[key] != dataset[key]:
            raise ValueError(f"incompatible {key}")
    ids = [case["id"] for case in dataset["cases"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate case id")
    rows = run["results"]
    if len(rows) != len(ids) or {row["id"] for row in rows} != set(ids):
        raise ValueError("missing, duplicate or unknown result id")
    for row in rows:
        if row["status"] == "error":
            if "verdicts" in row or not row.get("error"):
                raise ValueError("invalid execution error")
            continue
        if row["status"] != "ok":
            raise ValueError("invalid status")
        verdicts = row["verdicts"]
        if set(verdicts) != set(dataset["criteria"]):
            raise ValueError("missing or unknown criterion")
        if any(v not in VERDICTS for v in verdicts.values()):
            raise ValueError("invalid verdict")


def summarize(dataset, run):
    validate(dataset, run)
    expected = {case["id"]: case["expected"] for case in dataset["cases"]}
    stats = dict(matched=0, total=len(expected) * len(dataset["criteria"]),
                 unsafe_pass=0, false_reject=0, unclear=0, execution_errors=0)
    for row in run["results"]:
        if row["status"] == "error":
            stats["execution_errors"] += 1
            continue
        for criterion, verdict in row["verdicts"].items():
            target = expected[row["id"]][criterion]
            stats["matched"] += verdict == target
            stats["unsafe_pass"] += target == "fail" and verdict == "pass"
            stats["false_reject"] += target == "pass" and verdict == "fail"
            stats["unclear"] += verdict == "unclear"
    return stats


def compare(dataset, baseline, candidate):
    old, new = summarize(dataset, baseline), summarize(dataset, candidate)
    gate = (new["execution_errors"] == 0
            and new["unsafe_pass"] <= old["unsafe_pass"]
            and new["false_reject"] <= old["false_reject"]
            and new["unclear"] <= old["unclear"]
            and new["matched"] >= old["matched"])
    return {"baseline": old, "candidate": new, "gate": "PASS" if gate else "FAIL"}


if __name__ == "__main__":
    report = compare(load("cases.json"), load("baseline.json"), load("candidate.json"))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["gate"] == "PASS" else 1)
