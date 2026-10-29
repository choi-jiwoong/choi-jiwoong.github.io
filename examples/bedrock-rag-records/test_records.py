import unittest
from records import collect, legacy_ragas_rows


class RecordsTest(unittest.TestCase):
    def setUp(self):
        self.cases = [dict(id=str(i), question=f'q{i}', ground_truth=f'g{i}')
                      for i in range(3)]

    def test_single_retrieval_and_exact_context(self):
        calls = []
        seen = []
        def retrieve(question):
            calls.append(question)
            return [dict(text=f'context-{len(calls)}', source_id='public-demo')]
        def generate(question, contexts):
            seen.append(list(contexts))
            return 'synthetic answer'
        rows = collect(self.cases, retrieve, generate)
        self.assertEqual(len(calls), 3)
        self.assertEqual([r['contexts'] for r in rows], seen)

    def test_middle_failure_preserves_question_alignment(self):
        def generate(question, contexts):
            if question == 'q1':
                raise TimeoutError()
            return question + '-answer'
        rows = collect(self.cases, lambda q: [dict(text=q)], generate)
        self.assertEqual([r['status'] for r in rows], ['ok', 'error', 'ok'])
        usable = legacy_ragas_rows(rows)
        self.assertEqual([r['question'] for r in usable], ['q0', 'q2'])
        self.assertEqual([r['ground_truth'] for r in usable], ['g0', 'g2'])
        self.assertEqual(rows[1]['failed_stage'], 'generation')

    def test_retrieval_failure_does_not_call_generator(self):
        def retrieve(question):
            raise RuntimeError()
        def generate(question, contexts):
            self.fail('must not generate after failed retrieval')
        rows = collect(self.cases, retrieve, generate)
        self.assertTrue(all(r['failed_stage'] == 'retrieval' for r in rows))

    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError):
            collect([self.cases[0], self.cases[0]], None, None)


if __name__ == '__main__':
    unittest.main()
