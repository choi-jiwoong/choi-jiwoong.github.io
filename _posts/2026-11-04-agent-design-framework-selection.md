---
topic: ai
series: agent-design
series_order: 2
title: 'LangChain·LangGraph·Strands — 에이전트 프레임워크 선택 기준'
description: '가상의 도서관 안내를 직접 SDK로 만들 때와 프레임워크로 만들 때를 비교하고, 앱 구성·실행 흐름·관측 평가의 책임을 구분한다.'
date: 2026-11-04 04:00:00 +0900
categories: [AI]
tags: [Agent, LangChain, LangGraph, Strands, LangSmith]
---

도서관 안내 시스템에 “별빛 여행을 빌릴 수 있나요? 없으면 비슷한 책도 찾아주세요”라는 요청이 들어왔다고 하자. 도서 검색, 대출 가능 여부 조회, 대체 도서 탐색을 연결해야 한다. [앞 편](/posts/agent-design-cot-react/)에서는 도구의 결과를 다음 판단에 반영하는 루프를 설명했다. 이번에는 그 루프를 어떤 코드 구조로 만들지 살펴본다.

**프레임워크 없이도 도구 호출과 워크플로를 구현할 수 있다.** 선택 기준은 가능한 기능의 유무보다, 반복되는 연결 코드를 얼마나 맡기고 실행 흐름을 얼마나 직접 소유할지에 있다. 아래 도서관과 데이터는 모두 가상이며, 성능 순위를 매긴 실험은 하지 않았다.

## 왜 프레임워크를 쓰는가

모델 SDK로 도구 스키마를 전달하고, 반환된 호출 요청을 검증한 뒤 함수를 실행하고, 결과를 다시 모델에 보내면 에이전트 루프를 만들 수 있다. 검색 후 상태 조회라는 순서가 고정되어 있다면 일반 함수 두 개를 순서대로 호출해도 된다.

반면 여러 모델 제공자와 도구를 연결하면 메시지 형식, 스트리밍 이벤트, 오류 전달, 실행 기록을 맞추는 코드가 쌓인다. 프레임워크는 이런 반복 작업에 공통 인터페이스를 제공한다. 대신 그 인터페이스의 동작과 변경도 이해해야 한다. 코드 줄 수가 줄어드는 것과 운영 책임이 줄어드는 것은 같은 말이 아니다.

삼성SDS의 「랭체인(LangChain)이란 무엇인가?」는 외부 데이터 통합, 생태계, 도입 장단점을 살펴보는 공개 입문 자료다. 이 글도 그 문제의식을 참고했다. 다만 2024년 자료의 API와 제품 구성을 현재 기준으로 옮기지 않고, 아래 기술 설명은 2026년 11월 4일 확인한 공식 문서에 근거한다.

## 앱 구성, 실행 흐름, 관측은 서로 다른 책임이다

| 책임 | 도서관에서의 질문 | 도구를 바라보는 관점 |
|---|---|---|
| 앱 구성 | 모델과 검색 함수를 어떻게 연결할까? | LangChain의 모델·도구 인터페이스와 `create_agent` |
| 실행 흐름 제어 | 결과에 따라 어느 단계로 이동할까? | LangGraph의 상태·노드·에지, Strands의 에이전트 루프 |
| 관측·평가 | 어디서 실패했고 목표를 달성했을까? | LangSmith의 trace와 평가 기능 |

이 표는 제품의 기능을 배타적으로 나눈 목록이 아니다. LangChain에도 실행 루프가 있고 Strands에도 관측 기능이 있다. 먼저 책임을 나누면 이름이 비슷한 도구를 같은 층의 경쟁 제품으로 오해하지 않게 된다. LangSmith 역시 다른 세 프레임워크와 같은 방식으로 실행 구조를 고르는 항목은 아니다.

## LangChain: 공통 부품으로 에이전트를 구성한다

현재 Python 공식 문서의 진입점은 `langchain.agents.create_agent`다. 모델, 도구, 시스템 프롬프트를 지정하고 미들웨어로 동작을 확장하는 형태다. 따라서 LangChain을 “문서를 읽고 요약하는 선형 파이프라인 도구”에 한정하면 현재 에이전트 API를 설명하지 못한다. 공식 개요는 LangGraph를 더 낮은 수준의 오케스트레이션 계층으로 구분한다.

아래는 연결 형태만 보여주는 Python 코드다. `model`은 별도로 구성한 호환 모델 객체를 받는다. 특정 유료 모델이나 인증 설정을 숨긴 채 바로 실행되는 예제로 제시하지 않는다.

```python
from langchain.agents import create_agent


def search_catalog(title: str) -> str:
    """가상 도서 목록에서 제목을 검색한다."""
    return "book-1: 별빛 여행 — 가상 도서, 대출 가능"


def build_library_agent(model):
    return create_agent(
        model=model,
        tools=[search_catalog],
        system_prompt="도서관 안내원입니다. 조회 결과에 있는 사실만 안내하세요.",
    )
```

이 함수는 구성 의도를 보여준다. 실제 조회 API, 이용자별 권한, 모델 응답의 사실 검증을 구현한 것은 아니다. 본문에서는 문법만 정적으로 확인했으며 모델을 호출하지 않았다.

여러 제공자와 연결 부품을 공통 방식으로 다루고 싶다면 검토할 만하다. 다만 제공자별 기능이 완전히 같아지는 것은 아니므로, 모델 교체 시 도구 호출과 응답 형식은 다시 확인해야 한다.

## LangGraph: 상태와 이동 규칙을 코드에 드러낸다

[Graph API 공식 문서](https://docs.langchain.com/oss/python/langgraph/graph-api)는 실행 구조를 세 요소로 설명한다.

- **상태:** 현재까지 알고 있는 정보. 예를 들어 요청 제목, 검색 후보, 선택한 도서 ID다.
- **노드:** 상태를 읽고 작업한 뒤 갱신할 값을 반환하는 함수다.
- **에지:** 다음 노드를 정하는 고정 또는 조건부 이동 규칙이다.

도서 검색 결과가 0개면 대체 도서 안내로, 1개면 상태 조회로, 여러 개면 판본 확인으로 이동하도록 명시할 수 있다. 노드는 모델을 호출할 수도 있고 일반 코드만 실행할 수도 있다. 분기와 반복을 표현하므로 단순한 직선 파이프라인과도 다르다.

다음은 그중 **분기 규칙만** 떼어낸 독립 Python 모의 코드다. LangGraph API 구현인 것처럼 보이지 않도록 프레임워크를 사용하지 않았다.

```python
def next_step(candidates):
    if not candidates:
        return "suggest_alternatives"
    if len(candidates) > 1:
        return "ask_edition"
    return "check_availability"


assert next_step([]) == "suggest_alternatives"
assert next_step(["book-1"]) == "check_availability"
assert next_step(["book-1", "book-2"]) == "ask_edition"
```

LangGraph로 옮기면 후보 목록을 상태에 담고 이 규칙을 조건부 에지에 연결하는 식이다. 테스트에서는 세 갈래 분기만 확인했다. 도구 선택의 정확도나 예약 성공률을 검증한 결과는 아니다.

어떤 단계가 실행되는지 코드 리뷰에서 추적해야 하고, 모델 판단과 고정 절차를 섞어야 한다면 이 구조를 검토할 수 있다. 대신 상태 스키마와 갱신 규칙을 설계해야 하며 그래프가 커지면 분기 조합의 검증 부담도 커진다. 체크포인터와 중단·재개는 후속 4편에서 다룬다.

## Strands: 모델이 다음 도구를 선택하는 루프를 중심에 둔다

[Strands Agent Loop 공식 문서](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/agents/agent-loop/)는 모델 호출, 도구 요청 실행, 결과 전달, 다음 모델 호출의 반복을 설명한다. 도서관에서는 “현재 책이 없으니 대체 도서를 검색할지”를 모델이 관찰 결과에 따라 선택하는 식이다. 실행기는 도구 요청과 결과를 처리하며, 종료 사유와 실행 한도를 구분한다.

이것은 모든 분기 규칙을 없앤다는 뜻이 아니다. “조회만 허용한다”, “예약 확정에는 별도 조건이 필요하다” 같은 제약은 여전히 실행 코드와 정책이 책임져야 한다. 모델의 최종 답변으로 루프가 끝나도 사용자의 목표가 실제 달성됐는지는 별도로 확인해야 한다.

또한 **Strands는 AWS 전용이 아니다.** [공식 Model Providers 문서](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/model-providers/)에는 Amazon Bedrock 외에도 Anthropic, OpenAI, Google, Ollama 등의 연결이 나온다. 지원 범위는 언어·제공자·모델에 따라 확인해야 한다. Python 예제를 TypeScript로 옮길 때 클래스와 인자를 그대로 복사해서도 안 된다.

소수의 도구를 관찰 결과에 맞춰 유연하게 선택하는 구성을 원한다면 후보가 된다. 반대로 반드시 거쳐야 하는 단계가 많다면, 그 순서를 어떻게 강제하고 검증할지도 먼저 설계해야 한다. 여기서는 Strands 코드를 실행하거나 다른 프레임워크와 성능을 비교하지 않았다.

## LangSmith: 실행 기록을 보고 평가한다

LangSmith는 trace를 통해 실행을 살피고 디버깅·모니터링·평가를 돕는 도구다. 공식 문서는 여러 프레임워크와 제공자의 통합을 안내한다. LangChain을 사용해야만 관측할 수 있는 것으로 한정하지 않는다.

도서관 사례라면 “답변이 늦었다”를 모델 호출 지연과 조회 도구 지연으로 나누어 보고, 잘못된 도서를 조회한 실행을 평가 데이터로 남길 수 있다. 하지만 기록을 수집하는 것만으로 권한 오류나 잘못된 답변이 막히지는 않는다. 수집할 항목, 민감정보 처리, 평가 기준과 수정 절차를 설계해야 한다.

도구 선택·목표 달성·trace 평가의 구체적인 구현은 후속 7편에서 다룬다. 평가 기준의 배경은 기존 [LLM 평가 기준표 글](/posts/llm-judge-rubric-design/)에서 확인할 수 있다.

## 선택은 기능표보다 변경 비용으로 판단한다

아래 표는 공식 제품 순위가 아니라, 위 책임 구분을 도서관 예제에 적용한 설계 판단이다.

| 선택 | 먼저 검토할 상황 | 직접 감당할 비용 |
|---|---|---|
| 직접 SDK·일반 코드 | 도구가 적고 순서가 고정되어 있음 | 메시지 변환, 루프·오류 처리, 계측을 직접 유지 |
| LangChain | 공통 모델·도구 인터페이스로 에이전트를 구성하고 싶음 | 통합 패키지 의존성, 미들웨어 실행 순서, 버전 호환성 |
| LangGraph | 상태와 필수 분기를 코드로 명시해야 함 | 상태 갱신 규칙, 분기 테스트, 흐름 변경 시 영향 분석 |
| Strands | 관찰에 따라 모델이 도구를 선택하는 루프가 중심임 | 선택 경로의 변동성, 한도·실패 처리, 제공자별 기능 확인 |

직접 구현은 의존성을 줄일 수 있지만 자체 프레임워크를 만들 만큼 연결 코드가 커질 수 있다. 프레임워크 도입은 반복 코드를 줄일 수 있지만, 내부 추상화를 모르면 오류가 발생한 층을 찾기 어려워질 수 있다. LangChain과 LangGraph를 함께 쓰는 것처럼 선택지를 조합할 수도 있다.

따라서 도입 전에 같은 가상 요청으로 세 가지를 확인하는 편이 유용하다. 도서가 여러 개일 때 확인 질문으로 끝나는가, 조회 실패를 성공으로 바꾸지 않는가, 호출 한도에 도달했을 때 종료 사유를 남기는가. 이 기준은 프레임워크 이름과 무관하게 적용할 수 있다.

패키지 버전과 잠금 파일도 함께 관리해야 한다. 이 글은 확인일의 공개 Python 문서와 개념을 기준으로 했으며 특정 설치 버전을 실행 검증한 호환성 표가 아니다. 실제 도입 때는 선택한 버전의 API와 마이그레이션 문서를 다시 확인하고, 예외·종료·도구 결과 전달을 회귀 검증해야 한다.

## 다음 설계 질문으로 연결하기

도서 조회와 규정 검색의 차이는 기존 [RAG 기본 구조](/posts/rag-retrieval-grounded-generation/)에서, 실행 환경의 책임은 [Harness Engineering](/posts/harness-engineering-ai-agents/)에서 다뤘다. 도구 연결 규약과 에이전트 통신은 [MCP·A2A 소개](/posts/mcp-a2a-tools-and-agents/)를 참고하면 된다. 프레임워크를 선택하는 문제와 연결 프로토콜을 선택하는 문제는 구분해야 한다.

이 시리즈에서는 1~3편에서 원리와 구조 선택을 살피고, 4~8편에서 승인·권한·기억·평가·실행을 다룬다. 다음 3편에서는 Supervisor와 Swarm의 역할 분담을 비교한다. 여러 에이전트가 필요한지는 프레임워크를 선택한 뒤에도 별도로 판단할 문제다.

## 참고자료

아래 자료는 2026년 11월 4일 로그인 없이 공개 본문에 접근해 확인했다. 기술 설명은 공식 문서로 검증하고 삼성SDS 글은 필요성·생태계·장단점을 소개하는 구성 참고로 활용했다. 본문의 사례·비교표·코드는 독자적으로 작성했으며 원문 본문·그림·구현 코드를 복제하지 않았다.

- LangChain, **LangChain overview** — 현재 구성 요소와 LangGraph·LangSmith의 역할: <https://docs.langchain.com/oss/python/langchain/overview>
- LangChain, **Agents** — Python `create_agent`와 모델·도구·미들웨어: <https://docs.langchain.com/oss/python/langchain/agents>
- LangChain, **Graph API overview** — LangGraph 상태·노드·에지: <https://docs.langchain.com/oss/python/langgraph/graph-api>
- Strands Agents, **Agent Loop** — 도구 실행 루프와 종료 사유: <https://strandsagents.com/latest/documentation/docs/user-guide/concepts/agents/agent-loop/>
- Strands Agents, **Model Providers** — 제공자와 언어별 지원 범위: <https://strandsagents.com/latest/documentation/docs/user-guide/concepts/model-providers/>
- LangChain, **LangSmith Observability** — trace 기반 관측과 통합: <https://docs.langchain.com/langsmith/observability>
- LangChain, **LangSmith Evaluation** — 데이터셋과 평가 기준을 이용한 검증: <https://docs.langchain.com/langsmith/evaluation>
- 최성철 / 삼성SDS, **랭체인(LangChain)이란 무엇인가?** (표시 작성일 2024-08-16) — 공개 입문 해설: <https://www.samsungsds.com/kr/insights/what-is-langchain.html>

라이선스 확인: LangChain과 LangGraph 저장소의 공개 [LangChain LICENSE](https://github.com/langchain-ai/langchain/blob/master/LICENSE), [LangGraph LICENSE](https://github.com/langchain-ai/langgraph/blob/main/LICENSE)는 MIT다. 이는 다른 사이트의 설명·그림까지 같은 조건으로 재사용할 수 있다는 뜻은 아니다. 본문은 설명을 재구성하고 출처를 연결하는 방식으로 작성했다.
