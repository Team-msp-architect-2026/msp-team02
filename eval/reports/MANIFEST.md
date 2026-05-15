# Eval Reports Manifest

This manifest lists recorded evaluation artifacts. It does not replace the
JSONL evidence files or change any evaluation semantics.

## Corpus Marker

| Field | Value |
|---|---|
| Corpus file | `backend/data/law_chunks/all_chunks.json` |
| Corpus sha256 | `437f52c7789cd1b6b6ba415010e52a0aa491cbe0fe7bfb4b3772cc1673ecf687` |
| `selected_as_of` | `2026-04-11` |
| Chunk rows | `1722` |

## Reports

| Artifact | Status | Dataset | Runner | Executed at | Summary |
|---|---|---|---|---|---|
| `answer_evidence_2026-04-20.jsonl` | `acceptable` | `eval/mvp_in_scope_eval_v1.json` | `python eval/run_answer_evidence_report.py --top-k 5 --ef-search 100 --limit 60 --output eval/reports/answer_evidence_2026-04-20.jsonl` | `2026-04-20` | `PASS=44`, `PARTIAL=16`, `FAIL=0`; citation grounding/context id checks clean |
| `refusal_eval_2026-05-14.recovery-20260514165745.jsonl` | `known_gap` | `eval/refusal_eval_v1.json` | `python eval/run_refusal_eval.py --top-k 5 --ef-search 100 --output eval/reports/refusal_eval_2026-05-14.recovery-20260514165745.jsonl` | `2026-05-14T16:57:45+09:00` | `PASS=0`, `PARTIAL=0`, `FAIL=15`; runtime recovered, structural refusal gap observed |

## Refusal Eval Note

The refusal eval live run completed after runtime recovery. It is not passing
evidence. It records a known product behavior gap: current answer path is
citation-first and lacks explicit refusal mode. Existing evidence JSONL files
must not be overwritten when additional measurement runs are created.
