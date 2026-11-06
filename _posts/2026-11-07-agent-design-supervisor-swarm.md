---
topic: ai
series: agent-design
series_order: 3
title: 'Supervisor와 Swarm — 여러 에이전트는 어떻게 일을 나눌까'
description: '가상의 도서관 예약을 예로 중앙 조정과 직접 인계의 차이, 공유 상태와 실행 한도, 실패 처리 기준을 비교한다.'
date: 2026-11-07 04:35:00 +0900
categories: [AI]
tags: [Agent, Multi-Agent, LangGraph, Strands, Supervisor, Swarm]
---

“별빛 여행을 예약해 주세요. 이 지점에 없으면 다른 지점의 수령 방법도 알려주세요.”

가상의 도서관에서 이 요청을 처리하려면 소장 정보를 찾고, 지점 정책을 확인하고, 조건이 맞을 때 예약을 접수해야 한다. [2편](/posts/agent-design-framework-selection/)에서는 이 흐름을 어떤 실행 도구로 만들지 다뤘다. 이번에는 누가 다음 작업을 결정하고 누가 결과를 확정하는지 살펴본다.

## 검색과 예약에 각각 에이전트가 필요한가

요청을 해석하는 역할 하나에 소장 검색과 정책 조회 도구를 붙여도 된다. 지점과 도서가 정해진 뒤에는 일반 코드로 규칙을 검사하고 예약을 접수할 수 있다. 흐름이 짧고 도구 권한을 요청별로 제한할 수 있다면 이 구성으로 시작하기 쉽다.

담당을 나누는 이유는 작업마다 필요한 정보나 권한이 달라질 때 생긴다. 소장 검색에는 공개 목록이 필요하고, 예약 접수에는 인증된 이용자와 예약 쓰기 권한이 필요하다. 지점별 예외가 복잡해 정책 담당자가 별도 문맥에서 판단해야 할 수도 있다. 다만 역할을 분리하면 호출이 늘고, 담당 사이에 맥락을 전달하고 결과 충돌을 해결해야 한다. 권한 격리는 각 역할에 실제로 부여하는 자격과 서버 측 검사로 구현한다.

## Supervisor는 결과를 회수하고, Swarm은 담당을 넘긴다

| 설계 질문 | Supervisor | Swarm |
|---|---|---|
| 다음 담당을 누가 정하는가 | 중앙 조정자가 하위 작업을 호출한다. | 현재 담당이 다음 담당에게 제어권을 넘긴다. |
| 누가 이용자에게 답하는가 | 중앙 조정자가 하위 결과를 종합한다. | 마지막 담당이 답하거나, 앱이 지정한 마무리 단계가 답한다. |
| 도서관의 실행 경로 | 안내 → 소장 검색 → 안내 → 예약 → 안내 | 소장 검색 → 예약 → 필요시 지점 정책 담당 |
| 어느 때 적합한가 | 하나의 창구에서 여러 결과를 합치고 완료 기준을 일관되게 적용해야 할 때 | 다음 단계가 현재 담당만 아는 정보에 따라 달라지고, 담당 간 직접 전환이 자연스러울 때 |
| 주로 살필 장애 | 중앙 조정자가 잘못된 하위 작업을 고르거나 필수 실패를 누락한다. | 담당 간 왕복이 반복되거나, 인계 도중 필요한 정보가 사라진다. |

Supervisor 예에서 검색 담당은 가능한 도서와 지점만 반환한다. 조정자가 예약 담당을 호출하고, 예약 시스템에서 접수 번호를 받으면 그 결과를 이용자에게 전달한다. 조정자가 LLM일 필요는 없다. 검색 결과에서 선택지가 하나면 예약 단계로 가고 여러 개면 이용자에게 확인하는 규칙을 코드로 둘 수 있다.

Swarm에서는 검색 담당이 도서와 지점을 찾은 뒤 예약 담당에게 바로 넘긴다. 예약 담당이 타 지점 수령 정책을 확인해야 하면 정책 담당에게 넘길 수 있다. 여기서 **handoff**는 단순한 함수 호출과 달리 누가 다음 작업과 응답을 담당하는지 바꾼다. 인계를 받는 쪽에서 업무를 이어갈 수 있도록 이유, 확인된 사실, 미해결 항목을 함께 전달해야 한다.

## 공유 상태에 넣을 것과 남겨 둘 것

예약 요청의 공유 상태에는 요청 ID, 도서 ID, 선택한 지점, 정책 확인 결과, 현재 담당, 남은 호출 한도 정도면 충분하다. 검색 담당에게 이용자 인증 정보까지 보낼 이유는 없다. 인증 정보는 실행 환경에 두고, 예약 도구는 호출자가 해당 이용자의 예약을 만들 권한이 있는지 서버에서 확인한다.

| 상태 항목 | 갱신 책임 |
|---|---|
| 검색한 도서·지점 후보 | 소장 검색 담당 |
| 수령 가능 여부와 확인 시각 | 정책 조회 담당 |
| 예약 상태와 접수 번호 | 예약 시스템의 응답을 검증하는 실행 코드 |
| 현재 담당·인계 이력·남은 한도 | 오케스트레이터 |

같은 상태를 여러 노드가 수정할 수 있다면 병합 규칙을 정한다. 예를 들어 관찰 기록은 출처와 함께 누적할 수 있지만, 예약 상태는 모델의 자연어 응답이 덮어쓰지 못하게 한다. 도구 응답에서 얻은 사실과 에이전트가 제안한 다음 행동을 별도 필드에 두면 인계 뒤에도 근거를 구분할 수 있다.

## LangGraph와 Strands에서는 어디에 경계를 두나

2026년 11월 7일 기준 공식 문서와 Python 배포 메타데이터에서 LangGraph `1.2.20`(MIT), Strands Agents SDK `1.64.0`(Apache-2.0)을 확인했다. 아래 예제는 API와 흐름을 설명하기 위한 코드다. 모델 호출과 클라우드 실행은 하지 않았다.

**LangGraph.** 중앙 라우팅은 조정 노드와 각 작업 노드의 전환으로 표현할 수 있다. 조정 노드가 `Command`의 `update`로 상태를 바꾸고 `goto`로 다음 노드를 선택한다. 같은 노드에 무조건 실행되는 정적 에지를 함께 두면 두 경로가 모두 실행될 수 있으므로 동적 전환과 섞을 때 주의한다.

```python
from typing import Literal, TypedDict

from langgraph.types import Command


class BookingState(TypedDict):
    lookup: Literal["unread", "available", "unavailable", "failed"]
    booking: Literal["pending", "confirmed", "unknown"]


def supervise(state: BookingState) -> Command[Literal["lookup", "book", "reply"]]:
    if state["lookup"] == "unread":
        return Command(goto="lookup")
    if state["lookup"] == "available" and state["booking"] == "pending":
        return Command(goto="book")
    return Command(goto="reply")
```

이 노드만으로는 그래프가 완성되지 않는다. `lookup`과 `book`은 결과 상태를 기록한 뒤 조정 노드로 돌아오고, `reply`는 `END`에 연결한다. `book`에서 예약 결과를 확인하지 못했다면 `unknown`을 기록하므로 다시 조정 노드를 거쳐도 같은 요청을 곧바로 쓰지 않는다. `recursion_limit`는 그래프의 super-step 한도다. 모델 호출 수나 예약 API 호출 수를 제한하려면 각각 별도로 세야 한다. 모델이 하위 담당을 고르게 하고 싶다면 중앙 에이전트가 하위 에이전트를 도구로 호출하는 방식도 있다.

**Strands Python SDK.** `Swarm`은 담당 에이전트에 인계 도구를 제공하고 실행 및 인계 한도를 관리한다. 아래는 사전에 구성한 검색·예약·정책 에이전트를 연결하는 부분이다.

```python
from strands.multiagent import Swarm

swarm = Swarm(
    [catalog_agent, booking_agent, policy_agent],
    entry_point=catalog_agent,
    max_handoffs=4,
    max_iterations=6,
    execution_timeout=30.0,
    node_timeout=10.0,
)
```

`max_handoffs`는 인계 횟수, `max_iterations`는 전체 담당 실행 횟수의 상한이며, Python 예시의 시간 단위는 초다. 이 수치는 설명용이다. Python은 `handoff_to_agent` 도구를 사용하고, TypeScript SDK는 구조화된 인계 출력과 `maxSteps`를 사용한다. 각 SDK에서 지원하는 옵션 이름과 시간 단위를 확인한다.

## 종료 조건과 실패 상태를 먼저 정한다

- **성공은 결과로 확인한다.** 예약 시스템이 접수 번호와 상태를 반환할 때 예약 성공으로 표시한다. 검색만 성공했으면 이용자에게 확인한 소장 정보까지만 제공한다.
- **확인이 필요하면 중단한다.** 지점이 여러 곳이고 요청만으로 선택할 수 없다면 선택지를 보여준다. 담당끼리 같은 판단을 반복하지 않도록 현재 담당과 다음 행동을 기록한다.
- **한도는 계층마다 둔다.** 요청 전체 마감 시간, 인계·담당 실행 횟수, 모델·도구 호출 횟수, 개별 도구 타임아웃을 분리한다. 전체 마감 시간이 끝나면 새 작업을 시작하지 않는다.
- **실패를 다음 단계까지 전달한다.** 검색 오류와 검색 결과 없음은 다른 상태다. 예약 호출이 타임아웃되면 응답만 유실됐을 수 있다. 같은 요청 ID로 먼저 상태를 조회하고, 쓰기 재시도가 필요하다면 예약 시스템의 멱등성 지원을 확인한다.

중앙 조정이든 직접 인계든 필수 단계의 실패를 최종 응답이 숨기지 않아야 한다. 에이전트를 추가할지는 기존 흐름에서 실제로 분리할 권한, 문맥, 책임이 있는지부터 판단한다.

## MCP와 A2A는 어디에 쓰나

Supervisor와 Swarm은 **누가 다음 행동을 결정하는지** 설명하는 협업 패턴이다. MCP는 앱이 외부 도구나 컨텍스트와 연결되는 방식을, A2A는 독립된 에이전트 사이에서 요청과 작업 상태를 주고받는 방식을 표준화한다. 한 프로세스 안의 예약 흐름은 함수 호출만으로도 만들 수 있다. 다른 도서관의 에이전트와 통신할 때 A2A를 사용하더라도 예약을 누가 확정하고 타임아웃 이후 누가 상태를 조회할지는 앱에서 정한다. [MCP와 A2A의 역할 비교](/posts/mcp-a2a-tools-and-agents/)

## 참고자료

- LangChain — [Subagents](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents), [Handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs), [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- Strands Agents — [Swarm Multi-Agent Pattern](https://strandsagents.com/docs/user-guide/sdk/multi-agent/swarm/)
- LangChain 및 Strands Agents 배포 메타데이터 — [LangGraph 1.2.20](https://pypi.org/project/langgraph/1.2.20/), [Strands Agents SDK 1.64.0](https://pypi.org/project/strands-agents/1.64.0/)
- Model Context Protocol 프로젝트 — [MCP Specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- A2A 프로젝트 — [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
