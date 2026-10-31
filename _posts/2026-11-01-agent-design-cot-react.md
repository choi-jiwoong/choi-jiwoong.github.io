---
topic: ai
series: agent-design
series_order: 1
title: 'CoT와 ReAct — 풀이를 생성하는 것과 도구를 실행하는 것의 차이'
description: '가상의 도서관 사례로 CoT, Zero-shot CoT, ReAct를 비교하고 도구 호출·관찰·종료 조건을 구분한다.'
date: 2026-11-01 04:00:00 +0900
categories: [AI]
tags: [Agent, CoT, ReAct]
---

도서관 안내 시스템에 “별빛 여행이라는 책을 오늘 빌릴 수 있나요?”라고 물었다고 하자. 모델이 대출 규정을 차근차근 설명하는 것과 실제 도서 목록을 조회하는 것은 다르다. 설명이 자연스럽더라도 지금 남아 있는 책의 수를 확인했다는 뜻은 아니다.

「AI 에이전트 설계 — 원리부터 운영까지」의 첫 글은 이 차이에서 출발한다. 여기서 사용하는 도서관과 책 이름, 조회 결과는 모두 가상이다. 모델 호출이나 실제 대출 시스템 실험 결과를 소개하는 글이 아니다.

## CoT는 중간 풀이를 포함하는 출력 방식이다

Wei 등의 2022년 논문 *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*는 질문과 정답만 보여주는 대신 중간 풀이가 포함된 예시를 제공하는 방법을 연구했다. 논문은 특정 모델과 산술·상식·기호 추론 과제에서 성능 개선을 보고했다. 이를 모든 모델과 모든 질문에서 오류가 사라진다는 뜻으로 확장하면 안 된다.

도서관 문제로 바꾸면 “책이 7권 있고 4권이 대출 중이면 3권이 남는다”처럼 답을 도출하는 설명을 붙이는 방식이다. 하지만 이 계산은 입력한 숫자가 맞다는 전제에 의존한다. 실제로 7권이 있는지, 파손되거나 예약된 책이 있는지는 계산만으로 알 수 없다.

또한 생성된 중간 풀이는 모델의 실제 내부 계산을 그대로 읽어낸 기록이라고 단정할 수 없다. 독자는 그 설명을 검토할 수 있지만, 설명의 설득력과 답의 정확성은 따로 확인해야 한다.

## Zero-shot CoT는 풀이 예시 없이 시작한다

Kojima 등의 2022년 논문 *Large Language Models are Zero-Shot Reasoners*는 풀이 예시를 직접 제공하지 않고 단계적으로 생각하도록 유도하는 지시를 사용했다. 논문의 구성은 추론을 생성하는 단계와 그 출력을 이용해 최종 답을 추출하는 단계로 나뉜다.

차이는 예시의 유무에 있다. Wei 등의 접근이 풀이 예시를 보여준다면, Zero-shot CoT는 그런 예시 없이 지시로 풀이 생성을 유도한다. 어느 쪽도 도서관 데이터베이스 연결을 자동으로 만들어 주지 않는다. 2022년의 실험 결과를 현재 모든 모델에 같은 문구를 넣어야 한다는 규칙으로 받아들일 필요도 없다.

## ReAct는 행동 뒤에 돌아오는 관찰을 사용한다

Yao 등의 2022년 공개 논문 *ReAct: Synergizing Reasoning and Acting in Language Models*는 추론 텍스트와 행동을 번갈아 생성하며 외부 환경의 관찰을 활용하는 접근을 제시했다. 논문은 2023년 ICLR에 발표되었다. 핵심은 답을 길게 설명하는 것이 아니라, 행동의 결과가 다음 판단의 입력이 된다는 점이다.

가상의 도서관에서는 다음과 같은 흐름으로 설명할 수 있다. 아래 표는 이해를 위한 실행 명세이며 모델의 비공개 내부 사고를 재현한 기록이 아니다.

| 단계 | 시스템의 처리 | 확인되는 정보 |
|---|---|---|
| 요청 | 책 제목과 이용 날짜를 받는다 | 사용자가 원하는 조회 범위 |
| 도구 호출 | `search_catalog(title)`을 실행한다 | 동명 도서 후보와 도서 식별자 |
| 관찰 | 도구가 두 후보를 반환한다 | 제목만으로는 책을 확정할 수 없음 |
| 일시 종료 | 저자나 판본을 사용자에게 묻는다 | 임의로 첫 후보를 선택하지 않음 |
| 다음 요청 | 사용자가 지정한 도서의 `get_availability(book_id)`를 실행한다 | 조회 시점의 대출 가능 상태 |
| 최종 응답 | 결과와 조회 시점을 함께 안내한다 | 확인된 범위 안에서 답변 |

도구 호출 문자열을 출력한 것만으로 조회가 일어나지는 않는다. 애플리케이션이 도구 이름과 인자를 검증하고 실제 함수를 실행한 뒤 결과를 모델에 전달해야 한다. 실패한 호출을 성공한 관찰처럼 전달해서도 안 된다.

## 세 접근을 같은 발전 단계로 보지 않는다

| 접근 | 주로 바꾸는 것 | 저절로 해결되지 않는 것 |
|---|---|---|
| CoT | 예시를 통한 중간 풀이 생성 | 최신 데이터 접근, 입력 사실 검증 |
| Zero-shot CoT | 풀이 예시 없는 추론 유도 | 도구 연결, 실행 권한 |
| ReAct | 판단·행동·관찰의 반복 | 권한 통제, 정확성 보장, 종료 보장 |

책 7권에서 4권을 빼는 문제라면 일반 코드의 계산만으로 충분하다. 책 제목을 검색하고 상태를 확인하는 순서가 고정되어 있다면 고정 워크플로도 좋은 선택이다. 조회 결과에 따라 추가 검색이나 확인 질문을 선택해야 할 때 모델이 행동을 선택하는 구조를 검토할 수 있다. CoT에서 ReAct를 거쳐 멀티 에이전트로 이동해야 하는 필수 코스는 없다.

## 종료 조건은 실행 코드가 책임져야 한다

“필요하면 계속 검색하세요”만으로는 충분하지 않다. 같은 검색을 반복하거나 오류를 반복해서 만날 수 있다. 도서관 안내에서는 다음 조건을 명시할 수 있다.

- **완료:** 선택한 도서의 상태를 확인했고 그 근거로 답할 수 있다.
- **추가 입력 필요:** 동명 도서가 여러 개라 사용자의 선택이 필요하다.
- **실패:** 조회 시스템이 응답하지 않아 현재 상태를 알 수 없다.
- **한도 도달:** 허용한 호출 수 또는 전체 처리 시간을 넘었다.

다음은 직접 작성한 Python 모의 예제다. ReAct 모델 자체의 구현이 아니라, 모델이 제안했다고 가정한 도구 호출을 실행기가 제한하는 경계를 보여준다. 실제 SDK나 외부 서비스를 사용하지 않는다.

```python
def run_calls(calls, limit=2):
    tools = {
        "search_catalog": lambda title: [{"book_id": "book-1", "title": title}],
        "get_availability": lambda book_id: {"book_id": book_id, "available": True},
    }
    observations = []
    for index, (name, args) in enumerate(calls):
        if index >= limit:
            return "limit_reached", observations
        if name not in tools:
            return "tool_denied", observations
        try:
            result = tools[name](**args)
        except TypeError:
            return "invalid_arguments", observations
        observations.append({"tool": name, "result": result})
    return "calls_finished", observations
```

`calls_finished`는 주어진 호출 목록을 처리했다는 뜻이지 사용자의 목표 달성을 증명하지 않는다. 운영 구현에는 인자 스키마 검증, 개별 호출 타임아웃, 전체 마감 시간, 접근 권한, 결과 검증이 추가로 필요하다. 실제 예약처럼 상태를 바꾸는 도구는 조회와 구분하고 승인·중복 실행 방지도 설계해야 한다. 그 구현은 후속 편에서 다룬다.

## 설명과 증거를 구분해 남긴다

사용자에게는 장황한 사고 기록보다 “어떤 도서를 언제 조회했으며 무엇이 확인되지 않았는지”가 유용하다. 운영 기록에도 도구 이름, 검증한 인자, 결과 상태, 실패 사유를 남기면 실행 여부를 점검하기 쉽다. 설명 텍스트만으로 실제 실행을 증명할 수는 없다.

기존 [프롬프트 엔지니어링 글](/posts/prompt-engineering-and-meta-prompt/)은 요청과 행동 지시의 구성을, [Harness Engineering 글](/posts/harness-engineering-ai-agents/)은 실행 환경과 검증을 다룬다. 도구 연결 규약과 에이전트 간 통신은 [MCP·A2A 소개](/posts/mcp-a2a-tools-and-agents/)에서 이어 읽을 수 있다. 이번 글의 경계는 그보다 앞선 질문, 즉 **풀이를 생성했는가, 외부 관찰을 얻었는가**에 있다.

다음 편에서는 이 실행 구조를 직접 SDK로 만들 때와 LangChain·LangGraph·Strands를 사용할 때의 선택 기준을 비교한다.

## 참고자료

아래 공개 원문을 2026년 11월 1일 확인했다. 논문의 설명과 실험 결과는 원저자에게 귀속되며, 본문의 도서관 사례·표·코드는 독자적으로 작성했다. 원문 그림이나 코드를 복제하지 않았다.

- Jason Wei 외, **Chain-of-Thought Prompting Elicits Reasoning in Large Language Models** (2022), arXiv / NeurIPS: <https://arxiv.org/abs/2201.11903>
- Takeshi Kojima 외, **Large Language Models are Zero-Shot Reasoners** (2022), arXiv / NeurIPS: <https://arxiv.org/abs/2205.11916>
- Shunyu Yao 외, **ReAct: Synergizing Reasoning and Acting in Language Models** (2022 공개, ICLR 2023), arXiv: <https://arxiv.org/abs/2210.03629>
