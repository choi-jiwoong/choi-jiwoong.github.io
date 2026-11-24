---
topic: ai
series: agent-design
series_order: 7
title: '답변은 맞았는데 도구를 잘못 썼다면 — 에이전트 평가'
description: '도서관 예약 사례로 답변·도구 선택·목표 달성·trace를 나눠 평가하고, LangSmith와 AgentCore의 관측 및 평가 조건을 살펴본다.'
date: 2026-11-25 04:17:00 +0900
categories: [AI]
tags: [Agent, Evaluation, LangSmith, AgentCore, OpenTelemetry]
---

도서관 안내 에이전트가 “예약이 완료됐습니다”라고 답했다. 이용자가 원한 도서를 정확하게 설명했지만, 실행 기록을 보니 예약 도구를 호출하지 않았다. 또는 예약은 했지만 다른 지점을 선택했을 수도 있다.

답변의 자연스러움만 보면 두 실행을 놓치기 쉽다. 에이전트에서는 이용자에게 보이는 문장, 실행한 행동, 외부 시스템의 최종 상태를 함께 확인해야 한다. 이 글의 사례와 실행 기록은 모두 가상이다.

## 네 가지 질문으로 평가를 나눈다

| 평가 대상 | 도서관에서 확인할 것 | 필요한 근거 |
|---|---|---|
| 답변 | 도서·지점·예약 상태 설명이 맞는가 | 요청, 확인된 도구 응답, 최종 답변 |
| 도구 선택과 인자 | 조회·예약 도구를 적절히 사용했는가 | 제공된 도구 목록, 호출 순서, 입력값 |
| 목표 달성 | 요청한 조건의 예약이 실제로 접수됐는가 | 예약 시스템의 접수 상태와 요청 식별자 |
| 전체 실행 | 중복 쓰기·과도한 재시도·잘못된 권한 사용이 있었는가 | trace, 오류, 정책 판정, 외부 상태 |

예약 도구 호출의 HTTP 응답이 성공해도 접수가 거절됐을 수 있다. 반대로 타임아웃 뒤 예약이 접수됐다면 응답 생성 실패와 작업 실패를 분리해야 한다. 최종 상태를 확인할 수 없을 때에는 “미확인”으로 남겨 평가 대상과 복구 대상으로 추적한다.

목표 달성을 판정하는 평가자도 받은 기록에 의존한다. 예약 시스템의 결과가 trace에 없다면 “완료했다”는 모델 응답만으로 실제 완료를 확정하기 어렵다. 중요한 쓰기 작업은 시스템 상태를 코드로 조회해 대조한다.

## 참고 코드에는 평가 설정과 계측이 함께 있다

김문주의 개인 공개 실습 저장소 `moonjukhim/AWS`에서 `docs/online-evaluation.md`, 런타임 코드, Dockerfile, 평가 설정과 결과 조회 스크립트를 확인했다. 확인한 `master` 커밋은 `c363935806f2d22ab65d31d5acb251103d029d64`다.

`agentcore.json`의 `onlineEvalConfigs`에는 `Builtin.Correctness`, `Builtin.Helpfulness`, `Builtin.ToolSelectionAccuracy`, `Builtin.GoalSuccessRate`가 등록돼 있다. Dockerfile은 `opentelemetry-instrument`로 Python 진입점을 실행한다. 런타임은 Strands 에이전트를 만들고, 현재 span에 업무 요청 식별자를 추가한다. CDK 코드에는 Transaction Search 설정을 위한 사용자 지정 리소스도 있다.

이 구성을 배포했다는 사실만으로 평가 결과가 만들어졌다고 볼 수는 없다. 런타임에는 도구 초기화 실패 시 도구 없이 응답하는 경로도 있다. 이런 실행에서는 답변 품질과 도구를 통한 목표 달성 여부가 달라질 수 있으므로, 사용 가능한 도구와 축소된 실행 모드도 기록해야 한다.

저장소 루트와 확인한 파일에서 재사용 라이선스 표기를 확인하지 못했다. 아래 예제는 도서관 사례로 별도 작성했다. 원본의 비용·처리시간 설명은 이 글의 실측값으로 사용하지 않았다.

## HTTP span이 있다고 평가할 세션이 있는 것은 아니다

span은 개별 작업의 기록이고, trace는 관련 span을 연결한 실행 경로다. 세션은 여러 호출이나 대화 턴을 묶는 평가 단위가 될 수 있다.

일반 HTTP 계측은 통신 상태와 소요 시간을 보여준다. 모델 입력·출력, 도구 호출·결과, 에이전트 실행과 세션 연결이 없으면 평가자는 예약 과정을 재구성하기 어렵다. AgentCore 공식 문서도 지원되는 계측, 서비스 이름·세션 식별자, 대상 로그와 평가 설정을 함께 확인하도록 안내한다.

참고 문서는 `gen_ai` 의미를 가진 span과 `session.id` 연결을 강조한다. 환경변수만 복사하기보다 실제 출력된 이벤트의 이름·속성·부모 관계를 확인해야 한다. 저장·조회 과정에서 속성 이름의 표현이 달라질 수 있으므로 SDK와 로그 스키마에 맞춰 쿼리한다.

| 점검 순서 | 확인할 내용 |
|---|---|
| 수집 | 지원되는 계측이 에이전트·모델·도구 기록을 생성하고 내보내는가 |
| 연결 | 요청, trace와 세션이 올바르게 연결되는가 |
| 내용 | 평가에 필요한 입력·출력·도구 결과가 포함되는가 |
| 선택 | 평가 설정의 로그·서비스 필터와 샘플링 조건에 해당하는가 |
| 완료 | 세션 종료 조건 이후 평가 결과 또는 오류가 생성되는가 |

내용 수집에는 개인정보가 포함될 수 있다. 평가에 필요한 범위를 정하고 비밀값을 제거하며 접근 권한과 보존 기간을 설정한다. 평가 결과가 없을 때는 이를 점수 0과 구분하고, 샘플링 제외·수집 누락·처리 지연·평가 오류를 각각 살펴본다.

## 결과 조회 코드도 공식 API와 대조한다

참고 저장소의 `scripts/evaluate.py`는 평가 결과 로그에서 점수·설명·세션과 trace 식별자를 읽는다. 다만 `StartQuery`에 전달할 시작·종료 시각을 밀리초로 계산한다. 공식 CloudWatch Logs API의 해당 인자는 epoch **초** 단위다. 이 부분은 수정해 사용해야 한다.

문서와 스크립트에는 결과가 나타나는 시간에 대해서도 서로 다른 안내가 있다. 이를 고정된 대기 시간으로 정하기보다 세션 종료 설정, 수집과 평가 처리 상태를 확인한다. 로그 그룹 접두사도 실제 평가 설정의 출력 위치와 대조한다. 이 글은 정적 코드·문서 대조를 수행했으며 해당 AWS 환경에 질의하지 않았다.

## LangSmith와 AgentCore에서 평가 단위를 고른다

LangSmith는 trace에 모델·도구 실행을 연결하고, 평가 피드백을 실행 기록과 함께 살펴보는 기능을 제공한다. 오프라인에서는 준비한 요청과 기대 결과로 회귀 사례를 비교하고, 온라인에서는 운영 trace의 필터와 샘플링을 이용해 평가 대상을 고를 수 있다.

AgentCore도 온라인 샘플링·필터링과 선택한 span·trace를 대상으로 하는 온디맨드 평가를 제공한다. 평가자는 답변·도구·세션 등 확인하려는 단위에 맞춰 선택한다. 내장 평가자가 있다고 해서 예약 상태나 권한 규칙의 코드 검사가 사라지는 것은 아니다.

두 도구에서 공통으로 정할 것은 **평가 대상, 필요한 증거, 실패 판정 기준**이다. 모델 기반 평가에는 기준표와 사람 검토 사례를 연결하고, 순서·소유권·중복 쓰기 같은 명시적 조건에는 코드 검사를 병행한다. 평가 기준표와 판단자의 한계는 [기존 기준표 설계 글](/posts/llm-judge-rubric-design/)에서 다뤘다.

## 작은 모의 실행에서 답변과 행동을 따로 확인한다

다음 Python 예제는 모델 호출 없이, 가상의 실행 기록과 예약 시스템 상태를 비교한다. 설명한 지점이 맞더라도 다른 지점에 예약했다면 목표 달성을 실패로 판단한다.

```python
def evaluate_run(run, reservation):
    calls = run["tool_calls"]
    booking_calls = [c for c in calls if c["name"] == "reserve"]
    expected = run["expected"]
    return {
        "answer_matches_reference":
            run["answer"] == run["reference_answer"],
        "booking_called_once": len(booking_calls) == 1,
        "booking_arguments_match":
            len(booking_calls) == 1
            and booking_calls[0]["arguments"] == expected,
        "goal_confirmed":
            reservation is not None
            and reservation["status"] == "confirmed"
            and reservation["request_id"] == run["request_id"]
            and reservation["book_id"] == expected["book_id"]
            and reservation["branch_id"] == expected["branch_id"],
    }


run = {
    "request_id": "library-request-demo",
    "expected": {"book_id": "book-demo", "branch_id": "main"},
    "answer": "본관 예약을 완료했습니다.",
    "reference_answer": "본관 예약을 완료했습니다.",
    "tool_calls": [{
        "name": "reserve",
        "arguments": {"book_id": "book-demo", "branch_id": "annex"},
    }],
}
actual = {
    "request_id": "library-request-demo", "status": "confirmed",
    "book_id": "book-demo", "branch_id": "annex",
}
scores = evaluate_run(run, actual)
assert scores["answer_matches_reference"]
assert not scores["booking_arguments_match"]
assert not scores["goal_confirmed"]
```

로컬에서는 답변 문자열 일치와 다른 지점 예약 실패를 별도로 확인했다. 문자열 일치는 형식이 고정된 이 모의 사례에만 사용했다. 실제 자연어 응답에는 의미·근거·누락 조건을 평가하고, 도구 경로도 여러 정당한 대안을 허용할 수 있도록 설계한다.

운영 보고서에는 전체 요청 수, 평가 대상으로 선택된 세션 수, 평가 완료 수, 오류·미평가 수를 함께 표시한다. 평가자·모델·프롬프트·도구 버전과 관측 기간도 남긴다. 실패 trace를 개인정보가 제거된 회귀 사례로 옮기면 다음 변경에서 같은 문제가 재발하는지 확인할 수 있다. [회귀 평가 설계](/posts/llm-judge-regression-tests/)

## 참고자료

- 김문주 — [개인 공개 실습 저장소의 online-evaluation.md](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day5/04.it-incident-response-agent/docs/online-evaluation.md), [실제 런타임 코드](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day5/04.it-incident-response-agent/app/ITIncidentAgent/main.py), [결과 조회 코드](https://github.com/moonjukhim/AWS/blob/c363935806f2d22ab65d31d5acb251103d029d64/300-AI-MLADAS-Building-Adv-Agentic-Systems/92.sec/day5/04.it-incident-response-agent/scripts/evaluate.py)
- AWS — [Add observability to your Amazon Bedrock AgentCore resources](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability-configure.html), [Evaluation types](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/evaluations-types.html), [Built-in evaluators](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/built-in-evaluators-overview.html)
- AWS — [StartQuery API](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_StartQuery.html)
- LangChain — [Evaluation types](https://docs.langchain.com/langsmith/evaluation-types), [Set up LLM-as-a-judge online evaluators](https://docs.langchain.com/langsmith/online-evaluations-llm-as-judge)

기술 설명은 2026년 11월 25일 확인한 공개 자료를 기준으로 작성했다.
