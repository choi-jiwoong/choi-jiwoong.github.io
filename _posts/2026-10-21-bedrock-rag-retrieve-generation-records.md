---
topic: ai
series: bedrock-rag
series_order: 3
title: 'Bedrock RAG 검색·생성 분리 — 답변에 쓴 근거를 그대로 평가하기'
description: 'Retrieve와 생성 호출을 분리하고, 검색 재호출과 실패 행 누락으로 평가 입력이 어긋나는 문제를 방지하는 기록 구조를 만든다.'
date: 2026-10-21 11:00:00 +0900
last_modified_at: 2026-10-29
categories: [AI, AWS]
tags: [RAG, Bedrock, Retrieval, Evaluation, Python]
---

검색 결과를 평가하려면 어떤 자료로 답했는지 알아야 한다. 하지만 답변을 만든 뒤 같은 질문으로 다시 검색해 평가용 문맥을 채우면, 생성 당시의 근거를 평가하고 있다는 보장이 사라진다.

이번 글은 제공된 `Task-2.ipynb`와 `Task-3.ipynb`의 코드 검토를 바탕으로 한다. 저장 출력의 관찰과 코드에서 발견한 잠재적 문제를 구분한다. 클라우드 API를 새로 호출하지 않았으며, 제공하는 테스트는 가상 데이터로 기록 처리만 확인한다.

## Retrieve 뒤의 처리는 애플리케이션이 맡는다

[통합 호출](/posts/bedrock-rag-retrieve-and-generate/)과 달리 `Retrieve`는 검색 결과를 반환한다. 애플리케이션은 그 결과에서 사용할 근거를 고르고 프롬프트를 구성한 뒤 생성 모델을 호출한다.

```python
def retrieve(client, kb_id, question, count=5):
    response = client.retrieve(
        knowledgeBaseId=kb_id,
        retrievalQuery={"text": question},
        retrievalConfiguration={
            "vectorSearchConfiguration": {
                "numberOfResults": count
            }
        },
    )
    return response["retrievalResults"]
```

이 코드는 호출 형태를 설명한 예제이며 실행 검증한 AWS 연동 프로그램은 아니다. 실제 사용에는 KB 준비와 인증·리전·모델 접근 설정이 필요하다.

텍스트를 합칠 때는 내용만 남기기보다 원본 위치, 검색 순서, 문서 버전 등 필요한 출처 정보를 함께 보관한다. 검색 점수는 정답 확률로 해석하지 않는다.

## 검색 모드 비교에서는 다른 조건을 고정한다

Task-2의 직접 호출 예제는 `HYBRID`와 검색 개수 5를 사용한다. LangChain 예제는 `SEMANTIC`과 검색 개수 4를 사용한다. 프롬프트 전달 경로와 생성 설정도 동일하다고 확인되지 않는다.

따라서 두 답변의 차이를 “하이브리드 검색이 더 좋다” 또는 “LangChain이 더 정확하다”는 근거로 삼을 수 없다. 검색 모드만 비교하려면 개수와 생성 설정, 질문·원본 자료·프롬프트를 맞춰야 한다.

`HYBRID` 지원 여부는 벡터 저장소와 색인 구성에 달려 있다. 공식 API 문서의 OpenSearch Serverless 예시에서도 필터 가능한 텍스트 필드 등 조건을 설명한다. 옵션 이름만 붙여 모든 KB에서 동작한다고 가정하지 않는다.

## 질문의 시점과 근거의 시점을 대조한다

저장 출력에는 특정 연도의 수치를 묻는 질문에 이전 연도 문서가 검색된 사례가 있다. 직접 호출 결과는 이전 수치를 설명하면서 필요한 정보 일부가 없다고 답한다. LangChain 경로는 요청한 연도의 정보가 부족하다고 응답한다.

어느 쪽이든 질문의 대상 연도와 근거의 연도를 분리해 읽어야 한다. 이전 수치를 최신 수치처럼 옮기는 것은 검색 결과에 충실한 답변이라고 볼 수 없다. 해당 질문에 답할 수 없다는 사실을 명시하는 동작도 평가 대상이다.

이 관찰은 원본 저장 출력에 한정한다. 당시 전체 KB와 원본 문서가 첨부되지 않았으므로 필요한 자료가 정말 존재하지 않았는지까지 확정하지 않는다.

## 평가용으로 다시 검색하는 코드를 주의한다

Task-3에는 다음 흐름이 있다.

```python
answer = chain.invoke(query)  # 체인 내부에서 검색 후 생성
context = [doc.page_content for doc in retriever.invoke(query)]
```

두 번째 줄은 첫 검색의 결과를 가져오는 코드가 아니라 새 검색이다. 문서가 갱신됐거나 결과 순서가 달라지면 다른 문맥으로 답변을 평가하게 된다. 실제로 달라졌다는 증거는 없지만 코드 구조상 그 가능성이 있다.

개선 방향은 단순하다. **한 번 검색한 결과로 생성하고, 생성에 전달한 문맥을 같은 실행 기록에 저장한다.** 재정렬·잘라내기·요약을 적용했다면 그 처리 후 실제 전송한 문맥도 기록한다.

| 기록 항목 | 의미 |
|---|---|
| case_id, question, ground_truth | 질문·참조 정답의 연결 |
| contexts, sources | 생성에 제공한 근거와 출처 |
| answer | 실제 생성 결과 |
| status, failed_stage | 성공 여부와 실패 위치 |
| 실행 설정 | 모델·프롬프트·검색·문서 버전 |
| 문맥 해시 | 전송·평가 문맥의 동일성 점검 보조값 |

해시는 익명화가 아니다. 원문을 보관할 필요와 접근 권한은 따로 정해야 한다.

## 중간 실패가 질문과 정답을 밀어내지 않게 한다

원본 코드는 성공한 답변만 배열에 넣은 뒤 `questions[:len(answers)]`와 연결한다. 저장 출력에서는 5개 질문 모두 성공했으므로 이 실행에서 행이 어긋났다고 말할 수는 없다.

하지만 두 번째 질문이 실패하고 세 번째가 성공하면, 성공 답변 배열의 두 번째 답변을 두 번째 질문과 연결할 위험이 있다. 질문과 참조 정답을 처음부터 한 행으로 묶고 실패 행도 유지해야 한다.

```python
row = {
    "id": case["id"],
    "question": case["question"],
    "ground_truth": case["ground_truth"],
}
# 같은 row에 contexts, answer 또는 오류 상태를 추가한다.
```

평가 도구에 성공 행만 넘겨야 한다면 그 행에서 질문·정답·답변·근거를 함께 추출한다. 전체 요청 수와 제외한 실패 수는 별도로 보고한다.

## 비용 없이 확인할 수 있는 기록 테스트

[예제 코드](https://github.com/choi-jiwoong/choi-jiwoong.github.io/tree/main/examples/bedrock-rag-records)는 검색기와 생성기를 함수로 주입받는다. 테스트에서는 둘 다 가짜 함수를 사용한다.

```sh
cd examples/bedrock-rag-records
python3 -m unittest -v
```

확인하는 항목은 다음과 같다.

- 질문마다 검색을 한 번만 수행하는가?
- 생성에 넘긴 텍스트 문맥과 저장한 문맥이 같은가?
- 중간 질문이 실패해도 나머지 질문과 정답이 유지되는가?
- 검색 실패 뒤에는 생성하지 않는가?
- 중복 case_id를 거부하는가?

이 테스트는 기록 처리의 동작을 확인한다. 검색 품질, 생성 정확도, AWS 권한이나 Ragas 연동까지 검증하지는 않는다. 실제 어댑터가 문맥을 다시 바꾸지 않는지도 따로 확인해야 한다.

다음 글에서는 [RAGAS 점수와 원본 답변을 함께 읽는 방법](/posts/bedrock-ragas-metrics-diagnosis/)을 다룬다.

## 참고 자료

- 검토 자료: 제공된 Task-2, Task-3 노트북. 코드상의 위험과 실제 발생 사실을 구분함.
- [AWS 검색 설정 API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_KnowledgeBaseVectorSearchConfiguration.html)
- [오프라인 기록 예제](https://github.com/choi-jiwoong/choi-jiwoong.github.io/tree/main/examples/bedrock-rag-records)
