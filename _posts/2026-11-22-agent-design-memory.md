---
topic: ai
series: agent-design
series_order: 6
title: 'AI의 기억은 대화 기록과 무엇이 다를까'
description: '도서관 안내 사례로 대화 이력·실행 상태·장기 기억을 구분하고, AgentCore Memory의 비동기 추출과 격리·정정·삭제 경계를 살펴본다.'
date: 2026-11-22 04:11:00 +0900
categories: [AI]
tags: [Agent, AgentCore, Memory, LangGraph, Privacy]
---

이용자가 도서관 안내 에이전트에게 “큰 글씨 책을 먼저 추천해 주세요”라고 말했다. 다음 방문에도 이 선호를 반영하면 편리하다. 하지만 지난번 예약이 접수됐는지 묻는다면, 선호를 기억하는 것과는 다른 정보가 필요하다.

대화를 저장하고, 현재 작업을 이어가고, 다음 방문에 참고할 정보를 추리는 일에는 서로 다른 저장·조회 기준이 필요하다. [5편](/posts/agent-design-mcp-tool-authorization/)의 접근 통제도 기억의 저장과 검색에 각각 적용해야 한다. 이 글의 도서관과 이용자 정보는 모두 가상이다.

## 같은 대화에서 세 종류의 정보가 생긴다

| 구분 | 저장하는 내용 | 도서관 예 | 사용 범위 |
|---|---|---|---|
| 대화 이력 | 누가 무엇을 말했고 어떤 도구 응답을 받았는가 | “큰 글씨 책을 먼저 보여주세요”라는 원문 | 같은 대화의 맥락 복원 |
| 실행 상태 | 지금 어느 단계이고 무엇을 기다리는가 | 지점 선택 대기, 승인 대상 버전, 예약 요청 ID | 특정 작업의 재개·복구 |
| 장기 기억 | 이후에도 유용할 수 있는 선호·사실·요약 | 큰 글씨 판본을 우선 제안한다는 선호 | 허용된 여러 대화에서 재사용 |

체크포인터는 대화뿐 아니라 실행 상태를 보관할 수 있다. LangGraph에서는 스레드별 체크포인터와 스레드를 넘어 사용하는 store를 구분한다. [4편의 검토 대기](/posts/agent-design-human-in-the-loop/)에서 재개할 작업을 찾는 데는 스레드 상태가 필요하다.

장기 기억은 선택·추출·갱신을 거친다. 대화 원문을 오래 보관한다는 사실만으로 장기 기억의 검색 품질이나 정확성이 확보되지는 않는다. 삼성SDS의 공개 LangChain 설명에서 다루는 대화 관리 문제를 이 세 책임으로 나눠 보면 필요한 저장소를 고르기 쉽다.

## AgentCore Memory 실습에서 확인한 흐름

김문주의 개인 공개 실습 저장소 `moonjukhim/AWS`의 `05_Memory_Demo.ipynb`를 확인했다. 확인한 `master` 커밋은 `54889c894a5838b281824930700e4f25f47d22e5`다.

노트북은 이벤트를 저장하고 최근 대화를 조회한 뒤, 사용자 선호·사실·세션 요약 전략으로 장기 레코드를 추출하도록 구성한다. 이어서 Strands 후크와 세션 매니저를 이용해 기억을 검색하고 대화에 포함하는 두 가지 연결 방식을 보여준다.

설명 표에는 단기 기억에 세션 상태와 체크포인트가 포함될 수 있다고 적혀 있다. 직접 저장 예제는 사용자·에이전트·도구 메시지 이벤트를 다룬다. 메시지를 저장했다는 사실만으로 다른 프레임워크의 그래프 실행 위치까지 복구된다고 해석해서는 안 된다. 실행 상태의 저장·재개는 사용하는 런타임과 통합 코드에서 별도로 확인한다.

2026년 11월 22일 공식 데이터 플레인 API에서 `CreateEvent`, `RetrieveMemoryRecords`와 삭제 동작을 확인했다. 노트북의 Python 헬퍼 메서드 이름과 서비스 API 이름은 구분해야 한다. 해당 노트북에는 실행 결과가 저장돼 있지 않으며, 이 글에서도 모델 호출이나 AWS 리소스 생성은 실행하지 않았다.

## 저장 직후 검색되지 않을 수 있다

AgentCore의 장기 기억 추출은 비동기로 진행된다. 이벤트 저장 성공과 장기 레코드 검색 가능 시점은 다르다. 참고 노트북은 여러 번 검색하고 기다리는 루프를 사용한다. 그 대기 시간을 운영 환경의 완료 시간으로 보장할 수는 없다.

도서관 이용자가 방금 “이제 큰 글씨 여부는 상관없어요”라고 정정했다면 현재 대화에서는 그 명시적 요청을 바로 반영한다. 장기 검색 결과에 이전 선호가 남아 있어도 새 요청을 덮어쓰지 않도록 한다. 정정 내용은 출처와 시각을 붙여 저장하고, 추출 실패·지연 여부를 따로 추적한다.

요약은 긴 원문을 줄이는 과정이다. “이번 방문에만 별관에서 받겠다”가 “항상 별관을 선호한다”로 바뀌면 임시 조건이 지속 선호로 굳어진다. 원문 출처, 적용 기간과 예외 조건을 보존하고, 모순되는 값은 확인 대상으로 표시한다. 검색의 관련도 점수도 사실의 진실성이나 이용자의 동의를 나타내지 않는다.

## actor와 namespace를 권한 경계에 연결한다

노트북은 JWT에서 얻은 사용자 이름을 `actor_id`로 사용하고, 선호·사실 검색 경로에 해당 actor를 포함한다. 이 방식은 앞단의 인증 설정을 전제로 한다. 코드 안에서 JWT 페이로드를 디코딩하는 것 자체는 서명 검증이 아니다.

또한 IAM 제한 예제는 정책을 출력할 뿐, 실제로 연결하는 단계는 없다. actor가 다른지 묻는 모델 응답 한 번으로 데이터 격리를 검증할 수 없다. 서버가 인증된 주체에서 actor를 결정하고, 단기 이벤트 접근과 장기 namespace 검색 권한을 모두 제한해야 한다.

공식 문서는 namespace를 앞뒤 슬래시가 있는 형태로 정규화하며 IAM 조건에도 일치하는 값을 사용하도록 안내한다. 예를 들어 설명용 경로 `/library/readers/{actorId}/preferences/`를 저장·검색·정책에서 일관되게 사용한다. 경로가 구분돼 있어도 광범위한 자격 증명을 모델에게 제공하면 격리 경계가 약해진다.

검색된 기억은 참고 데이터로 다룬다. 과거 메시지에서 추출된 “검사를 생략하라” 같은 문구를 실행 지시로 승격시키지 않는다. 예약 상태와 소유 관계는 권위 있는 예약 시스템에서 다시 조회한다.

## 정정과 삭제는 파생 정보까지 추적한다

원문 이벤트를 지워도 이미 추출된 장기 레코드는 자동으로 지워지지 않는다고 AWS 문서는 명시한다. `DeleteEvent`와 `DeleteMemoryRecord`의 삭제 대상이 다르다.

“이 선호를 잊어주세요”라는 요청에는 삭제 범위를 정해야 한다. 원문 이벤트, 장기 레코드, 요약, 검색 캐시와 이미 구성한 대화 컨텍스트를 확인한다. 진행 중인 추출이 삭제한 정보를 다시 만들 수 있으므로, 요청 접수 시점부터 사용을 억제하고 후속 추출 결과도 정리하는 절차가 필요하다. 완료 여부는 저장소별로 기록한다.

참고 노트북에는 잘못된 기억의 정정·삭제 흐름이 없다. 서비스에서는 기억 항목에 출처, 생성·확인 시각과 유효 상태를 연결하고, 이용자가 열람·정정·삭제할 수 있는 경로를 제공해야 한다.

## 검색에 포함할 기억을 작게 검증한다

다음은 검색 후보의 소유자·유효 상태·삭제 여부를 검사하는 독립적인 Python 모의 예제다. 후보는 이미 추출된 것으로 가정한다. `principal`은 서버의 인증 계층이 확정한 식별자다.

```python
def visible_memories(principal, candidates, deleted_ids, now):
    return [
        record["text"]
        for record in candidates
        if record["owner"] == principal
        and record["status"] == "active"
        and record["id"] not in deleted_ids
        and record["expires_at"] > now
    ]


records = [
    {"id": "m1", "owner": "reader-a", "text": "큰 글씨 우선",
     "status": "active", "expires_at": 200},
    {"id": "m2", "owner": "reader-b", "text": "별관 선호",
     "status": "active", "expires_at": 200},
    {"id": "m3", "owner": "reader-a", "text": "이전 선호",
     "status": "superseded", "expires_at": 200},
]

assert visible_memories("reader-a", records, set(), 100) == ["큰 글씨 우선"]
assert visible_memories("reader-a", records, {"m1"}, 100) == []
assert visible_memories("reader-a", records, set(), 300) == []
```

로컬에서 타인 정보 제외, 정정된 값 제외, 삭제 표시 반영과 만료 처리를 확인했다. 이 함수의 삭제 표시는 사용을 억제하는 모의 장치다. 저장된 이벤트와 레코드의 실제 삭제 완료는 별도로 확인해야 한다.

실제 시스템에서는 소유자 조건을 저장소 조회에 포함하고, 페이지네이션 전체에 적용한다. 출력 직전에도 삭제 상태가 바뀌었는지 점검한다. 재시도와 지연 작업에는 기억 버전이나 삭제 기준 시각을 전달해, 오래된 결과가 새 상태를 덮어쓰지 않도록 한다.

## 참고자료

- 김문주 — [개인 공개 실습 저장소의 05_Memory_Demo.ipynb](https://github.com/moonjukhim/AWS/blob/54889c894a5838b281824930700e4f25f47d22e5/300-AI-MLAIDP-AdvGenAI/demo/05_Memory_Demo.ipynb). 루트와 해당 파일에서 재사용 라이선스 표기를 확인하지 못했으며, 본문 예제는 별도로 작성했다.
- AWS — [Memory types](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-types.html), [CreateEvent](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_CreateEvent.html), [RetrieveMemoryRecords](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_RetrieveMemoryRecords.html)
- AWS — [Specify long-term memory organization with namespaces](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/specify-long-term-memory-organization.html)
- AWS — [Delete an event](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/short-term-delete-event.html), [Delete memory records](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/long-term-delete-memory-records.html)
- LangChain — [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- 최성철 / 삼성SDS — [랭체인(LangChain)이란 무엇인가?](https://www.samsungsds.com/kr/insights/what-is-langchain.html), 표시 작성일 2024-08-16. 대화 관리 문제를 이해하기 위한 공개 해설이며 기술 동작은 위 공식 자료로 확인했다.
