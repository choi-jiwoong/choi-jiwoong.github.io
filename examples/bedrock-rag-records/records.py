"""Keep each answer tied to the exact text contexts sent to generation.

This is offline orchestration code. Callers supply retrieval and generation.
It neither calls AWS nor evaluates answer quality by itself.
"""
import hashlib
import json


def collect(cases, retrieve, generate):
    ids = [case['id'] for case in cases]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate case id')
    rows = []
    for case in cases:
        row = dict(case)
        stage = 'retrieval'
        try:
            docs = retrieve(case['question'])
            contexts = [doc['text'] for doc in docs]
            row['contexts'] = contexts
            row['sources'] = [doc.get('source_id') for doc in docs]
            encoded = json.dumps(contexts, ensure_ascii=False).encode('utf-8')
            row['context_sha256'] = hashlib.sha256(encoded).hexdigest()
            stage = 'generation'
            # A tuple prevents the generator from changing the stored list.
            row['answer'] = generate(case['question'], tuple(contexts))
            if not isinstance(row['answer'], str):
                raise TypeError('answer must be text')
            row['status'] = 'ok'
        except Exception as exc:
            row['status'] = 'error'
            row['failed_stage'] = stage
            # Do not put exception messages containing request data in logs.
            row['error_type'] = type(exc).__name__
        rows.append(row)
    return rows


def legacy_ragas_rows(rows):
    """Column names for the notebook's legacy schema, not a Ragas API call."""
    return [
        {key: row[key] for key in ('question', 'ground_truth', 'answer', 'contexts')}
        for row in rows if row['status'] == 'ok'
    ]
