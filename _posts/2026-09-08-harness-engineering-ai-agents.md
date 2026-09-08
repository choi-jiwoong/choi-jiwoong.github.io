---
title: "AI Agent 시대, 왜 Harness Engineering이 중요해졌을까"
description: "모델이 강해질수록 중요한 것은 모델 자체보다 에이전트가 일하는 환경이다. Harness Engineering이 무엇이고 왜 DevOps와 Platform Engineering의 다음 관심사가 될 수 있는지 정리해봤다."
date: 2026-09-08 14:20:00 +0900
categories: [AI]
tags: [AI, Agent, HarnessEngineering, GPT6, Astra, Codex, DevOps, PlatformEngineering]
---

GPT-6 Astra가 공개된 내용을 보면서 가장 흥미로웠던 건 단순히 모델이 더 똑똑해졌다는 점이 아니었다.

OpenAI는 Astra를 코딩, 리서치, 컴퓨터 사용, 복잡한 다단계 작업을 수행하는 모델로 소개하고 있다. 단순히 코드를 생성하는 것을 넘어 여러 단계를 연결해서 실제 작업을 끝까지 수행하는 방향이다.

그런데 여기서 한 가지 생각이 들었다.

**모델이 충분히 좋아진다면 다음 병목은 어디일까?**

예전에는 AI가 일을 못하면 모델 성능부터 의심했다.

하지만 최근 Agent를 사용하다 보면 꼭 그렇지만은 않다.

```text
코드는 작성할 수 있음
       ↓
그런데 프로젝트 구조를 모름
       ↓
테스트 방법을 모름
       ↓
로그를 못 봄
       ↓
배포 규칙을 모름
       ↓
결국 사람이 다시 개입
```

이 문제는 모델의 IQ보다 **모델이 일하고 있는 환경**에 더 가깝다.

그리고 이 영역을 요즘 **Harness Engineering**이라고 부르기 시작했다.

---

# Harness가 뭔데?

먼저 아주 단순하게 생각해보면 LLM은 이런 구조다.

```text
Input
  ↓
Model
  ↓
Output
```

ChatGPT에 질문하고 답을 받는 정도라면 이것만으로 충분하다.

하지만 개발 Agent에게 원하는 것은 다르다.

예를 들어:

> 로그인 오류를 찾아서 수정하고 PR을 만들어줘.

라는 요청을 했다고 해보자.

실제로 필요한 작업은 훨씬 많다.

```text
Issue 확인
   ↓
Repository 분석
   ↓
관련 코드 탐색
   ↓
문제 재현
   ↓
로그 확인
   ↓
코드 수정
   ↓
Test 실행
   ↓
Lint / Build
   ↓
PR 생성
   ↓
Review 피드백 반영
```

모델 하나만 있다고 이 모든 것이 자동으로 되는 것은 아니다.

모델 주변에는 여러 시스템이 필요하다.

| 구성 요소 | 역할 |
|---|---|
| Model | 판단하고 코드를 생성 |
| Context | 프로젝트 구조와 규칙 제공 |
| Tools | Git, Terminal, Browser 등의 실제 작업 수단 |
| Sandbox | 안전하게 코드를 실행하는 환경 |
| Permissions | Agent가 할 수 있는 작업의 범위 제한 |
| Tests / CI | 결과가 맞는지 자동 검증 |
| Observability | 로그와 메트릭을 통해 상태 파악 |
| Agent Loop | 실패 → 분석 → 수정 → 재검증 |
| Escalation | 판단하기 어려운 경우 사람에게 전달 |

이걸 하나의 작업 시스템으로 묶는 것이 **Agent Harness**라고 이해하면 쉽다.

```text
              ┌──────────────┐
              │     Human    │
              └──────┬───────┘
                     │ Intent
                     ▼
              ┌──────────────┐
              │  AI Model    │
              │ GPT-6 Astra  │
              └──────┬───────┘
                     │
        ┌────────────┴────────────┐
        │      Agent Harness      │
        │                         │
        │ Context                 │
        │ Tools                   │
        │ Sandbox                 │
        │ Permissions             │
        │ Tests / CI              │
        │ Observability           │
        │ Retry / Recovery        │
        │ Review                  │
        └────────────┬────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      GitHub      Terminal      Browser
```

결국 모델이 **두뇌**라면,

Harness는 그 두뇌가 실제 세상에서 일할 수 있도록 만들어주는 **몸과 작업 환경**에 가깝다.

---

# OpenAI도 비슷한 문제를 겪었다

OpenAI가 2026년 2월 공개한 Harness Engineering 글이 재미있다.

한 팀이 실제 제품을 만들면서 사람이 직접 작성한 코드 없이 Codex가 코드, 테스트, CI, 문서, Observability, 내부 툴링까지 작성하도록 하는 실험을 진행했다.

여기서 핵심 문장이 있다.

> Humans steer. Agents execute.

사람은 방향을 정하고 Agent가 실행한다는 의미다.

그런데 처음부터 Agent가 모든 것을 잘한 것은 아니었다.

OpenAI가 설명한 초기 병목은 흥미롭게도 **모델이 부족해서가 아니라 환경이 부족해서**였다.

Agent가 높은 수준의 목표를 수행하기 위해 필요한 도구, 구조, 문서와 피드백 루프가 충분하지 않았다. 그래서 엔지니어의 역할이 코드 작성에서 **Agent가 일하기 좋은 환경을 만드는 일**로 점점 이동했다고 설명한다.

이 부분이 Harness Engineering의 핵심이라고 생각한다.

---

# 좋은 Harness는 어떤 모습일까?

개발 Agent를 기준으로 생각해보면 크게 몇 가지가 중요해 보인다.

## 1. Repository가 Agent에게 읽기 쉬워야 한다

사람 개발자는 몇 달 동안 프로젝트를 보면서 암묵적인 규칙을 배운다.

Agent에게는 그런 시간이 없다.

```text
이 서비스는 어디에 있는지
Test는 어떻게 실행하는지
DB migration 규칙은 무엇인지
어떤 디렉터리를 수정하면 안 되는지
배포는 어떻게 이루어지는지
```

이런 정보가 명시적으로 존재해야 한다.

그래서 `AGENTS.md`, Architecture 문서, README와 같은 파일의 역할이 커진다.

하지만 문서를 무한히 넣는다고 좋은 것도 아니다.

Agent에게 거대한 설명서 하나를 주는 것보다 **필요한 정보를 찾아갈 수 있는 지도**를 제공하는 것이 더 중요하다.

즉:

```text
README
  │
  ├─ architecture/
  ├─ development/
  ├─ testing/
  ├─ deployment/
  └─ troubleshooting/
```

처럼 구조화된 지식이 중요해진다.

---

# 2. Agent에게 Tool을 줘야 한다

코딩 Agent에게 코드만 보여주는 것은 개발자에게 IDE 없이 소스 코드 PDF만 주는 것과 비슷하다.

실제로 개발하려면 여러 도구가 필요하다.

```text
Git
Terminal
Database
Browser
Logs
Metrics
CI
Issue Tracker
Cloud Console
```

Codex 같은 Agent도 결국 이런 도구를 사용해야 실제 작업을 수행할 수 있다.

여기서 중요한 건 **Tool을 많이 주는 것이 아니라 적절하게 주는 것**이다.

예를 들어:

```text
Agent

Production DB DELETE 권한 ❌
Staging DB READ/WRITE      ✅

Production Deploy          ❌
Preview Deploy             ✅

Git force push             ❌
Feature branch push        ✅
```

처럼 권한도 설계해야 한다.

이 부분은 기존 IAM이나 DevOps와 굉장히 비슷하다.

---

# 3. Test가 Agent의 눈이 된다

사람 개발자는 코드를 보고 이상한 점을 어느 정도 감지한다.

Agent에게 가장 강력한 피드백 중 하나는 자동화된 테스트다.

```text
Agent
 │
 │ 코드 수정
 ▼
Test
 │
 ├─ PASS → 다음 단계
 │
 └─ FAIL
      │
      ▼
    로그 분석
      │
      ▼
    코드 수정
```

Test가 없다면 Agent는 자기 코드가 맞는지 판단하기 어렵다.

그래서 Agent 시대에는 테스트가 단순한 품질 관리 도구에서 **Agent에게 제공하는 피드백 시스템**으로 의미가 커질 수 있다.

CI 역시 마찬가지다.

```text
Build
Lint
Unit Test
Integration Test
E2E Test
Security Scan
```

이런 시스템이 잘 갖춰진 프로젝트일수록 Agent가 자율적으로 작업하기 쉬워진다.

---

# 4. Observability도 Agent가 읽을 수 있어야 한다

이 부분은 개인적으로 DevOps 입장에서 가장 재미있다.

운영 장애를 생각해보자.

사람이라면:

```text
Dashboard 확인
→ Error 증가 확인
→ 로그 검색
→ 특정 API 확인
→ 코드 확인
```

과정을 거친다.

Agent도 마찬가지다.

단지 Agent가 볼 수 있는 인터페이스가 필요하다.

```text
Agent
 │
 ├─ Prometheus
 ├─ Grafana
 ├─ Loki
 ├─ CloudWatch
 ├─ OpenTelemetry
 └─ Sentry
```

Observability가 사람만 보는 Dashboard가 아니라 **Agent가 질문하고 분석할 수 있는 데이터 인터페이스**가 되는 것이다.

앞으로 Observability 설계 자체도 조금 달라질 수 있다고 생각한다.

---

# 5. 실패했을 때 돌아오는 길이 있어야 한다

Agent를 사용하면 성공 경로보다 실패 경로가 더 중요할 수 있다.

예를 들어 배포가 실패했다.

좋지 않은 Harness:

```text
Deploy Failed
     ↓
Agent 종료
```

조금 더 좋은 Harness:

```text
Deploy Failed
     ↓
로그 수집
     ↓
원인 분석
     ↓
수정
     ↓
Test
     ↓
Retry
```

그리고 무한 Retry를 막는 것도 필요하다.

```text
1차 실패
→ Agent 재시도

2차 실패
→ 다른 전략

3차 실패
→ Human escalation
```

이런 구조 자체가 Harness다.

---

# 결국 DevOps와 굉장히 닮아 있다

Harness Engineering이라는 말을 처음 들으면 완전히 새로운 AI 분야처럼 들린다.

그런데 하나씩 뜯어보면 익숙한 것들이 많다.

| Harness Engineering | 기존 개발 영역 |
|---|---|
| Sandbox | Container / VM |
| Permissions | IAM |
| Agent Tools | Developer Platform |
| Validation | CI/CD |
| Feedback Loop | Monitoring |
| Agent Context | Documentation |
| Guardrails | Policy as Code |
| Execution Environment | Infrastructure |
| Observability | Logging / Metrics / Tracing |
| Orchestration | Workflow Engine |

그래서 Harness Engineering은 새로운 기술이라기보다는

**기존 DevOps와 Platform Engineering을 AI Agent가 사용할 수 있도록 다시 설계하는 과정**

에 더 가까워 보인다.

이 정의를 보면 거의 AI 시대의 Platform Engineering에 가깝다.

---

# GPT-6 Astra가 중요한 이유도 여기에 있다

GPT-6 Astra가 중요한 이유는 단순히 더 좋은 코드를 만들어서가 아니다.

Astra는 코딩뿐 아니라 브라우저 사용, 리서치, 컴퓨터 조작과 복잡한 다단계 작업을 수행하는 방향으로 발전했다.

모델이 이런 수준으로 올라가면 질문이 바뀐다.

예전에는:

> 이 모델이 코드를 작성할 수 있을까?

였다면 앞으로는:

> 이 모델에게 어디까지 권한을 줄 수 있을까?

> 어떤 검증 시스템을 붙여야 할까?

> 실패했을 때 어떻게 복구할까?

> 어떤 작업은 사람이 승인해야 할까?

가 더 중요해진다.

즉 모델 성능이 좋아질수록 오히려 **시스템 엔지니어링의 중요성이 커진다.**

---

# 예를 들어 이런 개발 환경을 만들 수 있다

내가 개인적으로 만들어보고 싶은 구조는 이런 형태다.

```text
GitHub Issue
     │
     ▼
AI Agent
     │
     ├─ Repository 분석
     ├─ 관련 문서 탐색
     ├─ Branch 생성
     ├─ 코드 수정
     └─ Test 실행
             │
             ▼
          CI Pipeline
             │
      ┌──────┴──────┐
      │             │
    PASS           FAIL
      │             │
      ▼             ▼
   Preview       Agent 재분석
   Deploy            │
      │              └── 수정 → Test
      ▼
  Browser Test
      │
      ▼
     PR
      │
      ▼
 Human Review
```

여기서 AI 모델 자체는 시스템의 일부일 뿐이다.

진짜 중요한 것은 그 주변이다.

```text
Repository 구조
Test
CI
Preview 환경
Logs
Permissions
Documentation
Review 정책
```

이게 제대로 갖춰져 있어야 Agent가 안정적으로 움직인다.

---

# 앞으로 좋은 프로젝트의 기준도 달라질 수 있다

지금까지 좋은 개발 환경의 기준은 보통:

```text
새로운 개발자가
얼마나 빨리 프로젝트를 이해할 수 있는가?
```

였다.

앞으로는 하나가 추가될 것 같다.

```text
새로운 AI Agent가
얼마나 빨리 프로젝트를 이해하고
안전하게 작업할 수 있는가?
```

예를 들어 같은 두 프로젝트가 있다고 해보자.

### Project A

```text
문서 거의 없음
Test 부족
CI 느림
암묵적인 규칙 많음
로컬 환경 구축 복잡
```

### Project B

```text
명확한 Architecture
AGENTS.md
빠른 Test
Preview 환경
표준화된 명령어
좋은 Observability
명확한 권한
```

사람에게도 B가 좋은 프로젝트지만,

Agent에게는 그 차이가 훨씬 더 커질 가능성이 있다.

---

# 코드 작성보다 환경 설계가 중요해질 수도 있다

Harness Engineering 사례에서 개인적으로 가장 인상 깊었던 부분은 이것이었다.

Agent가 실패했을 때 인간이 직접 코드를 수정하는 대신:

```text
Agent에게 무엇이 부족했지?
```

를 찾는다는 점이다.

Tool이 부족하면 Tool을 만든다.

문서가 부족하면 문서를 만든다.

Test가 부족하면 Test를 만든다.

Guardrail이 부족하면 규칙을 만든다.

그러면 다음 Agent는 같은 문제를 더 잘 해결한다.

이건 기존 개발에서도 익숙한 사고방식이다.

```text
사람이 반복 작업
      ↓
자동화

장애 반복
      ↓
Monitoring / Alert

배포 실수 반복
      ↓
CI/CD

환경 차이 문제
      ↓
Container
```

Harness Engineering도 결국 같은 방향이다.

```text
Agent가 반복적으로 실패
        ↓
Harness 개선
```

사람의 실수를 자동화로 줄여왔던 DevOps처럼,

앞으로는 **Agent의 실패를 시스템 개선으로 줄이는 과정**이 중요해질 수 있다.

---

# 결론

GPT-6 Astra 같은 모델을 보면서 느끼는 것은 모델 경쟁의 다음 단계가 단순히 "누가 더 똑똑한가"만은 아니라는 점이다.

모델이 충분히 강해질수록:

| 과거 | 앞으로 |
|---|---|
| 코드 생성 | 작업 완료 |
| 답변 정확도 | End-to-End 성공률 |
| 사람 중심 Tool | Agent가 사용할 수 있는 Tool |
| Manual Review | Automated Feedback Loop |
| Model Engineering | Model + Harness Engineering |

으로 관심사가 이동할 가능성이 높다.

결국:

```text
좋은 Model
    +
좋은 Context
    +
좋은 Tools
    +
좋은 Tests
    +
좋은 Infrastructure
    +
좋은 Guardrails

        ↓

신뢰할 수 있는 Agent
```

가 된다.

그래서 Harness Engineering을 한 문장으로 표현한다면 나는 이렇게 정리하고 싶다.

> **Harness Engineering은 AI에게 일을 시키는 기술이 아니라, AI가 일을 잘할 수밖에 없는 시스템을 만드는 엔지니어링이다.**

그리고 생각보다 이 영역은 새로운 AI 기술이라기보다 우리가 이미 해오던

**DevOps, Platform Engineering, Automation, Observability, IAM**

과 굉장히 가까운 곳에 있다.

프롬프트를 어떻게 만들고, AI의 행동 규칙을 어떻게 설계할지는 별도의 문제다. 이 부분은 [프롬프트 엔지니어링에서 메타프롬프트까지](/posts/prompt-engineering-and-meta-prompt/)에서 따로 정리했다.

어쩌면 AI Agent 시대에 DevOps 엔지니어가 맡게 될 가장 재미있는 역할 중 하나가 바로 이 영역일지도 모르겠다.

---

## 참고 자료

- [OpenAI — GPT-6 Astra](https://openai.com/index/gpt-6-astra/)
- [OpenAI — GPT Release Notes](https://openai.com/products/release-notes/)
- [OpenAI — Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
- [OpenAI — Codex for Engineering](https://openai.com/business/solutions/engineering/)
- [OpenAI — Codex](https://openai.com/codex/)

> GPT-6 Astra 및 Codex 관련 내용은 2026년 9월 기준 OpenAI 공개 자료를 바탕으로 정리했다.
