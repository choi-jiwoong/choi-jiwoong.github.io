---
topic: ai
series: agent-design
series_order: 4
title: 'AI 에이전트는 언제 사람을 기다려야 할까'
description: '도서관 예약 예외를 예로 분류와 승인 경계를 나누고, LangGraph interrupt·resume와 체크포인터의 동작 및 운영 한계를 살펴본다.'
date: 2026-11-16 04:43:00 +0900
categories: [AI]
tags: [Agent, LangGraph, Human-in-the-loop, Checkpoint]
---

도서관 안내 에이전트가 “마감 시간이 지났지만 오늘 꼭 책을 수령하게 해주세요”라는 요청을 받았다. 운영시간을 안내하는 일과 예외 수령을 허용하는 일에는 서로 다른 권한이 필요하다. 답변을 잘 생성하더라도 예외를 승인할 권한까지 생기지는 않는다.

[3편](/posts/agent-design-supervisor-swarm/)에서는 담당 사이에 일을 나누는 구조를 살펴봤다. 이번에는 담당자의 판단이 필요할 때 실행을 멈추고, 검토한 내용과 연결해 다시 시작하는 방법을 다룬다. 사례와 도서 정보는 모두 가상이다.

## 분류 결과에 실행 권한을 맡기지 않는다

요청을 세 경로로 나눠 보자.

| 경로 | 도서관 요청 | 실행 조건 |
|---|---|---|
| 안내 | 운영시간이나 수령 방법 문의 | 확인된 안내 자료 범위에서 응답 |
| 확인 필요 | 도서나 수령 지점이 불명확 | 이용자의 선택을 받은 뒤 계속 |
| 담당자 검토 | 마감 이후 수령 등 정책 예외 | 권한 있는 담당자가 구체적인 처리안을 검토 |

LLM 분류기는 경로를 제안할 수 있다. 구조화된 출력으로 경로 이름을 제한하면 코드가 다룰 값의 형태를 맞출 수 있다. 분류의 정확성과 승인 권한은 별도로 검사해야 한다. 예외 처리가 포함된 요청은 모델이 “단순 문의”라고 분류해도 실행 계층에서 검토 대상으로 돌린다.

질문에 답할 근거가 부족해 사람에게 넘기는 것과, 쓰기 작업의 승인을 받는 것도 구분한다. 앞의 경우에는 정보 보완이 필요하고, 뒤의 경우에는 누가 어느 도서·지점·처리안을 승인했는지가 필요하다.

## 참고 코드는 어떤 경계까지 보여주나

김문주의 개인 공개 실습 저장소 `moonjukhim/AWS`의 `email_agent.py`를 읽었다. 확인한 `master` 커밋은 `fa0dbe6c80c3bf1d796cca6db45da59b2b31523d`다.

코드는 메일을 `spam / simple / escalate`로 분류하고, FAQ 답변이 불충분하면 검토 경로로 넘긴다. 검토 경로에서는 티켓을 만들거나 연결한 후 `human_review`에서 `interrupt()`로 멈춘다. 재개 입력은 담당자 답장으로 사용된다. 자동 답변과 담당자 답장의 “발송”은 모두 `print` 모사이며, 데모 실행부에는 담당자 응답을 대신하는 함수도 있다. 따라서 이 파일을 실제 발송·승인 시스템으로 해석하면 안 된다.

자동 응답의 `answered_from_faq`도 모델이 생성한 값이다. FAQ 근거를 독립적으로 검증한 결과로 취급할 수 없다. 운영 환경에서는 근거 문서와 허용 작업을 코드에서 확인하고, 검토 요청을 실제 담당자 화면에 전달하는 부분을 구현해야 한다.

저장소 루트의 공개 목록과 해당 파일에서 재사용을 허용하는 라이선스 표기를 확인하지 못했다. 이 글은 원본 코드를 옮기지 않고 흐름을 설명하며, 아래 예제는 도서관 사례로 별도 작성했다.

## interrupt와 resume를 연결한다

LangGraph에서는 체크포인터가 스레드 상태를 보관하고, `thread_id`가 그 상태를 찾는 키가 된다. `interrupt()`에는 호출자가 검토 화면에 표시할 수 있는 JSON 직렬화 가능한 값을 넣는다. 기본 `invoke()` API의 중단 결과는 `__interrupt__`에서 확인하고, 같은 스레드에 `Command(resume=...)`를 전달해 재개한다. 재개 값은 노드 안의 `interrupt()` 반환값으로 들어온다.

아래는 모델과 외부 API 없이 검토 경계만 보여주는 Python 예제다. LangGraph `1.2.22`를 기준으로 작성했으며, 로컬에서 중단 후 승인·거절 값으로 각각 재개되는 흐름을 확인했다.

```python
from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, END, StateGraph
from langgraph.types import Command, interrupt


class ReviewState(TypedDict):
    request_id: str
    proposal: str
    decision: str


def review(state: ReviewState):
    decision = interrupt({
        "request_id": state["request_id"],
        "proposal": state["proposal"],
        "choices": ["approve", "reject"],
    })
    if decision not in ("approve", "reject"):
        raise ValueError("Unsupported decision")
    return {"decision": decision}


builder = StateGraph(ReviewState)
builder.add_node("review", review)
builder.add_edge(START, "review")
builder.add_edge("review", END)
graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "library-review-demo"}}
paused = graph.invoke({
    "request_id": "request-demo-01",
    "proposal": "별관 수령 창구에서 예외 수령 가능 여부 확인",
    "decision": "pending",
}, config)
assert paused["__interrupt__"]
assert graph.get_state(config).values["decision"] == "pending"

finished = graph.invoke(Command(resume="approve"), config)
assert finished["decision"] == "approve"
```

이 예제의 재개 입력은 코드에서 넣은 모의 결정이다. 실제 예약이나 안내 메시지는 전송하지 않는다. 실제 서비스의 재개 API는 로그인한 검토자의 권한을 확인한 뒤, 해당 요청에 허용된 결정만 전달해야 한다. `thread_id`를 알고 있다는 사실만으로 재개를 허용해서는 안 된다.

## 재개할 때 노드가 다시 실행된다

`interrupt()`가 있던 노드는 재개 시 처음부터 실행된다. 따라서 그 앞에 티켓 생성이나 알림 발송을 넣으면 중복 실행될 수 있다. 참고 코드가 티켓 생성 노드와 검토 노드를 분리한 이유도 여기에 있다. 중단을 알리는 내부 예외가 런타임까지 전달되도록 `interrupt()`를 포괄적인 예외 처리로 삼키지 않는다.

노드를 나눠도 외부 시스템에 정확히 한 번 쓰는 것이 자동으로 보장되지는 않는다. 예약 성공 직후 체크포인트 기록 전에 프로세스가 종료될 수 있다. 실제 쓰기 도구에는 요청별 멱등성 키를 두고, 재시도 전에 기존 결과를 조회하는 절차가 필요하다.

도서관 예에서는 승인된 처리안을 상태에 저장하고, 실행 직전에 현재 예약 가능 여부와 승인 대상 버전을 다시 비교한다. 담당자가 A지점 수령을 검토하는 사이 이용자가 B지점으로 바꿨다면 이전 승인을 그대로 사용하지 않는다. 변경된 내용으로 다시 검토하거나, 명확히 정한 정책에 따라 새 요청으로 분리한다.

## 기다리는 상태도 운영 대상이다

| 확인 항목 | 구현할 책임 |
|---|---|
| 누가 검토할 수 있는가 | 서버에서 역할·요청 소유 관계 확인 |
| 무엇을 승인했는가 | 요청 ID, 처리안 버전, 검토자, 결정 시각 기록 |
| 얼마나 기다리는가 | 만료 시각, 취소와 재요청 정책 정의 |
| 중복 결정이 들어오면 어떻게 하는가 | 상태 버전 비교로 한 결정만 수락 |
| 재시작 후 이어갈 수 있는가 | 영속 체크포인터와 동일한 스레드 식별자 유지 |
| 예약 상태가 바뀌었는가 | 쓰기 직전 조건 재검증과 결과 조회 |

`interrupt()` 자체는 재개 입력이 올 때까지 기다린다. 대기 만료와 담당자 알림은 애플리케이션에서 운영한다. 대기 중인 요청에는 새 입력이 같은 작업을 덮어쓰지 않도록 스레드별 동시 실행 정책도 둔다.

`InMemorySaver`는 프로세스의 RAM에 저장하므로 재시작 뒤 상태를 복구할 수 없다. 운영에서는 데이터베이스 기반 체크포인터를 구성하고 접근 통제, 보존 기간, 삭제 및 복구 절차를 함께 정한다. 체크포인터에는 대화 이력뿐 아니라 현재 실행 상태가 들어갈 수 있다. 이 상태와 여러 대화에서 재사용할 장기 기억의 차이는 후속편에서 다룬다.

사람에게 넘길 경계는 모델의 확신 정도만으로 정하기 어렵다. 도서관의 정책 예외처럼 권한 있는 판단이 필요한 행동을 먼저 식별하고, 검토할 내용과 재개 조건을 실행 구조에 반영한다.

## 참고자료

- 김문주 — [개인 공개 실습 저장소의 email_agent.py](https://github.com/moonjukhim/AWS/blob/fa0dbe6c80c3bf1d796cca6db45da59b2b31523d/300-AI-MLDGAI-GenAI/98.LangGraph/email_agent.py). 분류, 검토 대기, 모의 발송 흐름을 코드로 확인했다.
- LangChain — [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts). 중단·재개, 노드 재실행 및 부수효과 처리의 공식 문서다.
- LangChain — [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence). 스레드 체크포인터와 장기 저장소, 인메모리 저장의 범위를 확인했다.
- LangChain / PyPI — [LangGraph 1.2.22](https://pypi.org/project/langgraph/1.2.22/). 2026년 11월 16일 확인한 Python 배포 버전이며 라이선스는 MIT다.
