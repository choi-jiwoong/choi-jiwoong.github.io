---
topic: ai
series: agent-design
series_order: 8
title: '모든 단계에 LLM이 필요할까 — 판단과 실행 분리하기'
description: '도서관 예약 사례로 구조화된 판단 이후 일반 코드로 실행하는 경계를 정하고, 부분 실패·재시도·멱등성과 confidence의 한계를 살펴본다.'
date: 2026-11-28 04:19:00 +0900
categories: [AI]
tags: [Agent, Workflow, MCP, Idempotency, Reliability]
---

도서관 이용자가 “별빛 여행을 본관에서 수령하도록 예약해 주세요”라고 요청했다. 도서와 지점을 찾고 이용자의 선택까지 확인했다면, 다음 단계에 필요한 값은 이미 정해져 있다. 예약 도구에 그 값을 전달하는 데 다시 모델의 판단을 요청할 필요가 있을까?

자연어 해석이나 모호한 요청의 보완에는 모델이 도움이 된다. 도서 ID·지점·처리 규칙이 확정된 뒤에는 일반 코드로 다음 단계를 선택할 수 있다. 시리즈 마지막 편에서는 이 경계를 어디에 두고, 실행 실패를 어떻게 다룰지 살펴본다. 사례와 식별자는 모두 가상이다.

## 판단 결과를 실행 계약으로 만든다

| 단계 | 도서관에서 할 일 | 확인할 계약 |
|---|---|---|
| 요청 해석 | 도서·수령 조건을 파악하고 누락을 확인 | 모호한 조건은 이용자에게 질문 |
| 판단·검증 | 예약 가능 여부와 정책 예외 판단 | 구조화된 값, 조회 근거, 권한 확인 |
| 실행 | 예약 생성·상태 기록·알림 작업 등록 | 확정된 인자, 멱등성 키, 결과 검증 |
| 보고·복구 | 접수·대기·실패·미확인을 구분 | 외부 상태와 일치하는 완료 조건 |

구조화된 출력은 코드가 받을 형태를 정한다. 도서 ID가 실제로 존재하는지, 예약 권한이 있는지, 승인된 지점과 일치하는지는 서버가 추가로 확인해야 한다. 형식 검사를 통과한 모델 출력에도 틀린 값이 들어갈 수 있다.

LangGraph 공식 문서는 미리 정한 코드 경로를 따르는 워크플로와 모델이 경로를 정하는 에이전트를 구분한다. 하나의 앱 안에서도 필요한 부분에 두 방식을 결합할 수 있다.

## 참고 구현은 마지막 모델 호출을 제거한다

김문주의 개인 공개 실습 저장소 `moonjukhim/AWS`에서 ADR-0014와 `routing.py`, `main.py`, 구조화된 출력 도구를 확인했다. 확인한 `master` 커밋은 `c363935806f2d22ab65d31d5acb251103d029d64`다.

원본의 첫 두 단계는 모델이 판단과 검토 결과를 만든다. 마지막 단계는 `decide_action()`의 결과에 따라 일반 코드가 MCP 도구를 직접 호출한다. `MCPClient.call_tool_async()`로 이미 확보한 인자를 전달하는 구성이다. 실행 계층에서 또 하나의 에이전트를 만들 필요가 없는 상황을 보여준다.

다만 ADR의 “올바른 인자를 항상 사용한다”는 설명은 범위를 좁혀 읽어야 한다. 실행 단계에서 모델이 인자를 새로 생성하는 과정을 줄여도, 앞 단계에서 만들어진 값의 정확성까지 보장되지는 않는다. 원본의 지연·비용 개선 수치는 이 글의 실측으로 사용하지 않았다.

2026년 11월 28일 Strands Python 공식 API에서도 직접 도구 호출의 `tool_use_id`, `name`, `arguments`를 확인했다. 여기서는 원본을 배포하거나 모델을 호출하지 않았다. 저장소 루트와 확인한 파일에서 재사용 라이선스 표기를 확인하지 못했으며 아래 예제는 별도로 작성했다.

## confidence는 검증된 정답 확률과 다르다

원본의 검토 모델은 0~100의 confidence를 생성한다. 라우팅 코드는 낮은 confidence로 자동 처리가 요청되면 사람 검토로 변경한다. 높은 confidence라도 이미 사람 검토로 지정됐으면 자동 처리로 강제 변경하지 않는다.

이 점수는 모델이 출력한 판단 값이다. 90이라는 숫자가 유사한 요청 100개 중 90개의 정확성을 보장한다는 뜻으로 해석할 수 없다. 자동 처리 경계를 정하려면 사람 검토 기준과 실제 오류 유형을 바탕으로 점수·경로의 의미를 별도로 확인해야 한다.

특히 권한, 도서 존재 여부, 예약 가능 수량처럼 코드로 검사할 조건을 confidence에 맡기지 않는다. 정책 예외는 [사람 검토 흐름](/posts/agent-design-human-in-the-loop/)에 연결하고, 데이터 소유권은 [도구 권한 검사](/posts/agent-design-mcp-tool-authorization/)에서 확인한다.

## 주석과 실행 코드가 다른 부분도 있다

`routing.py`의 상단 설명은 구조화된 출력이 없으면 사람 검토로 간다고 적혀 있다. 실제 `resolve_decision()`은 첫 판단이 누락되면 `REJECT`를 반환하고, 검토 결과 누락 시에는 `HUMAN_REVIEW`를 반환한다. 두 누락 경로의 결과가 다르다. `main.py`의 정규식 대체 처리 관련 주석도 현재 라우팅 함수의 실제 동작과 일치하지 않는다.

도서관 앱에서는 판단 누락을 “예약 불가”라는 업무 결론과 구분하는 편이 적절하다. 입력이나 도구 결과가 부족했다면 미완료 상태로 보존하고 확인 요청 또는 운영자 검토로 보낸다. 명시적인 거절과 처리 실패를 같은 상태로 합치면 이용자에게 잘못된 결론을 전달할 수 있다.

원본의 첫 모델 프롬프트에도 조회 실패 시 조건부 수용과 거절이라는 상충 지시가 있다. 구조화된 출력 도구는 문자열을 대문자로 바꾸지만 허용된 결정 값 전체를 런타임에서 제한하지는 않는다. 배포 전에는 모순을 정리하고 허용값·필수 근거·실행 가능 조건을 코드에서 검증해야 한다.

## 예외를 잡고 계속하는 것이 완료를 뜻하지는 않는다

원본은 여러 도구 호출을 `try/except`로 감싸 오류를 기록하고 계속 진행한다. 레코드 생성이 실패한 뒤에도 다음 알림 경로로 갈 수 있고, 마지막에는 처리 완료 문구를 출력한다. ADR의 실행 단순화와 별개로, 업무 완료를 판정할 상태가 더 필요하다.

도서관 예약에서는 다음과 같이 나눌 수 있다.

- 예약 생성이 확인되면 접수 번호를 저장한다.
- 알림만 실패했다면 예약을 다시 만들지 않고 알림 작업을 재시도한다.
- 예약 호출이 타임아웃되면 같은 요청 키로 기존 결과를 조회한다.
- 필수 검사가 거부되면 자동 재시도를 멈추고 이유를 기록한다.
- 결과를 아직 확인하지 못했다면 이용자에게 미확인 상태를 전달한다.

코드 경로가 결정적이어도 네트워크·동시 요청·외부 상태는 바뀐다. 각 호출에 마감 시간과 제한된 재시도 정책을 두고, 재시도 가능한 오류와 정책 거부를 구분한다. 예약과 알림을 분리하려면 예약 기록과 알림 작업을 같은 트랜잭션에 저장하는 방식도 고려할 수 있다. 알림 소비자에도 중복 방지가 필요하다.

## 같은 예약 요청은 같은 결과로 연결한다

아래는 외부 API 없이 SQLite에서 요청 키의 재사용을 확인하는 Python 예제다. 같은 이용자의 같은 키와 인자는 기존 결과를 반환하고, 같은 키에 다른 인자가 오면 거부한다.

```python
import sqlite3

db = sqlite3.connect(":memory:")
db.execute("""
    CREATE TABLE reservations (
        id INTEGER PRIMARY KEY,
        actor TEXT NOT NULL,
        request_key TEXT NOT NULL,
        book_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        UNIQUE(actor, request_key)
    )
""")


def reserve(actor, request_key, book_id, branch_id):
    with db:
        db.execute(
            """INSERT INTO reservations(actor, request_key, book_id, branch_id)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(actor, request_key) DO NOTHING""",
            (actor, request_key, book_id, branch_id),
        )
        row = db.execute(
            """SELECT id, book_id, branch_id FROM reservations
               WHERE actor = ? AND request_key = ?""",
            (actor, request_key),
        ).fetchone()
        if row[1:] != (book_id, branch_id):
            raise ValueError("Request key reused with different arguments")
        return row[0]


first = reserve("reader-demo", "request-demo", "book-demo", "main")
again = reserve("reader-demo", "request-demo", "book-demo", "main")
assert first == again
assert db.execute("SELECT COUNT(*) FROM reservations").fetchone()[0] == 1
```

로컬에서 동일 요청의 결과 재사용과 인자가 다른 키 재사용의 거부를 확인했다. 인메모리 데이터베이스라 프로세스 종료 후 기록은 사라진다. 실제 도서 재고·권한·알림과 연결한 구현은 포함하지 않았다.

운영에서는 인증된 이용자와 요청 키를 연결하고, 예약 상태 변경과 키 기록을 원자적으로 처리한다. 동시 요청, 처리 중 재시도, 키 보존 기간과 만료 뒤 중복 요청의 동작도 정한다. MCP의 호출 식별자만 새로 만드는 것으로 이런 업무 멱등성 계약이 자동 구현되지는 않는다.

참고 코드의 구조화된 결과는 모듈 전역 변수에 저장되고 요청마다 초기화된다. 해당 파일도 동시 요청 공유 시 안전하지 않다고 명시한다. 여러 요청을 동시에 처리하는 환경에서는 요청별 상태로 분리해야 한다.

## 판단과 실행을 각각 평가한다

[7편의 에이전트 평가](/posts/agent-design-evaluation/)에서 나눈 기준을 그대로 적용할 수 있다. 판단 단계에는 근거·정책·불확실성을, 실행 단계에는 인자 일치·중복 쓰기·부분 실패 복구를 확인한다. 결정적 실행을 도입할지는 작업에 필요한 값과 경로가 이미 확정됐는지부터 판단한다.

이 시리즈에서는 풀이와 행동의 차이에서 출발해 프레임워크·협업 구조, 사람 검토, 도구 권한, 기억과 평가를 다뤘다. 실행 가능한 범위를 코드로 정하고 외부 상태를 확인하는 책임은 이 모든 구조에서 이어진다.

## 참고자료

- 김문주 — [개인 공개 실습 저장소의 ADR-0014](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day4/03.event-driven-claims-agent/docs/decisions/0014-deterministic-phase3-no-llm.md), [routing.py](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day4/03.event-driven-claims-agent/app/claimsagent/routing.py), [main.py](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day4/03.event-driven-claims-agent/app/claimsagent/main.py), [structured_output.py](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day4/03.event-driven-claims-agent/app/claimsagent/tools/structured_output.py)
- Strands Agents — [Python MCPClient API](https://strandsagents.com/docs/api/python/strands.tools.mcp.mcp_client/)
- LangChain — [Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- AWS Well-Architected Framework — [REL04-BP04 Make mutating operations idempotent](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel04-bp04.html)

기술 설명은 2026년 11월 28일 확인한 공개 자료를 기준으로 작성했다.
