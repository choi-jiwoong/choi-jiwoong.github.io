---
title: "AWS Security Agent는 기존 보안 스캐너와 뭐가 다를까"
description: "AWS Security Agent와 AWS Continuum이 Design Review, Code Review, Threat Modeling, Penetration Testing을 어떻게 연결하는지 AppSec 관점에서 정리했다."
date: 2026-10-08 13:25:00 +0900
categories: [AWS]
tags: [AWS, Security, AWSContinuum, SecurityAgent, AppSec, DevSecOps, AI]
---

Application Security를 구성하다 보면 도구가 계속 늘어난다.

```text
SAST
SCA
DAST
Pentest
Threat Modeling
Code Review
```

각 도구가 보는 영역이 다르기 때문이다.

SAST는 Source Code를 잘 보고, DAST는 실행 중인 Application을 보고, Pentest는 실제 공격 가능성을 확인한다.

문제는 이 결과가 서로 잘 연결되지 않는다는 점이다.

```text
Code Finding
    ↓
Runtime에서 실제 Exploit 가능한가?
    ↓
Business Impact는 어느 정도인가?
    ↓
누가 Fix할 것인가?
```

이 연결을 결국 사람이 직접 해야 했다.

AWS Security Agent가 흥미로운 이유는 단순히 AI로 취약점을 찾는 데 있지 않다.

**Design, Code, Runtime Security Test를 하나의 Agent Context로 연결하려는 시도**라는 점이 더 중요해 보였다.

---

# AWS Security Agent는 지금 AWS Continuum의 일부다

AWS 공식 문서를 보면 현재 Security Agent는 **AWS Continuum의 일부**로 설명된다.

AWS Continuum은 Security Risk를:

```text
Discover
   ↓
Prioritize
   ↓
Validate
   ↓
Remediate
```

하는 흐름을 목표로 한다.

Security Agent 쪽에서는 Application Development Lifecycle에 더 가까운 기능을 담당한다.

```text
Design Review
Threat Modeling
Code Review
Penetration Testing
Remediation
```

즉 하나의 Scanner라기보다 **Application Security Workflow를 Agent 기반으로 연결하는 Platform**에 가깝다.

---

# Agent Space가 Application의 Security Context가 된다

Security Agent를 구성할 때 먼저 등장하는 개념이 **Agent Space**다.

Agent Space는 특정 Application을 기준으로 Security Context를 모아두는 단위다.

```text
Agent Space
    │
    ├─ Source Code
    ├─ Design Docs
    ├─ Security Requirements
    ├─ Penetration Test Target
    └─ Findings
```

이 구조가 중요한 이유는 단순하다.

기존 Scanner는 보통:

```text
File
→ Rule
→ Finding
```

형태로 동작했다면,

Security Agent는:

```text
Source Code
+
Architecture
+
Security Requirement
+
Application Context
        ↓
     Analysis
```

처럼 더 넓은 Context를 사용한다.

---

# Design Review: Code가 생기기 전에 보는 Security

보안 검토는 보통 Code가 만들어진 뒤 시작하는 경우가 많다.

```text
Design
  ↓
Code
  ↓
Deploy
  ↓
Security Review
```

하지만 Architecture 단계에서 이미 잘못된 선택이 있었다면 수정 비용이 커진다.

Design Review는 이 문제를 앞으로 당긴다.

```text
Design Doc
Architecture
API Spec
        ↓
Security Agent
        ↓
Security Requirements와 비교
```

이 구조를 보면 Shift Left라는 말이 조금 더 현실적으로 느껴진다.

단순히:

```text
CI에서 Scanner를 더 빨리 돌린다
```

가 아니라:

```text
구현 전에 Security Decision을 검토한다
```

는 방향이기 때문이다.

---

# Threat Modeling도 자동화 범위에 들어왔다

Threat Modeling은 중요하지만 실제 프로젝트에서는 자주 생략된다.

이유는 간단하다.

시간이 많이 들기 때문이다.

AWS Security Agent는 Source Code나 Design Document를 기반으로 Application Architecture를 분석하고 Threat Model을 생성할 수 있다.

결과에는:

```text
Architecture
Trust Boundary
Data Flow
Sensitive Asset
Threat
Severity
Recommendation
```

같은 정보가 포함된다.

개념적으로는:

```text
Design Document
      +
Source Code
      ↓
Threat Model
      ↓
Threats
      ↓
Mitigation
```

구조다.

이 기능이 특히 유용해 보이는 지점은 새 기능 개발 전이다.

예를 들어:

```text
새 결제 API 설계
      ↓
Threat Modeling
      ↓
Authentication Boundary 문제 발견
      ↓
구현 전에 수정
```

처럼 Code 작성 전에 Risk를 발견할 수 있다.

---

# Code Review는 단순 Pattern Matching을 넘어서려 한다

Code Review 기능은 Repository 전체 Scan과 변경분 중심의 Review를 지원한다.

Full Scan은 전체 Codebase를 분석하고, Differential Scan은 변경된 Code 중심으로 분석한다.

GitHub와 연결하면 Pull Request에 Security Finding을 전달할 수도 있다.

흐름은 대략 이렇게 볼 수 있다.

```text
Pull Request
    ↓
Code Review
    ↓
Finding
    ↓
Risk Reasoning
    ↓
Suggested Fix
```

이 부분에서 기존 SAST와 차이가 생긴다.

기존 방식:

```text
Rule Match
   ↓
Possible Vulnerability
```

Agent 방식:

```text
Repository Context
      ↓
Potential Vulnerability
      ↓
Contextual Analysis
      ↓
Remediation Guidance
```

물론 이것이 False Positive를 완전히 없앤다는 뜻은 아니다.

하지만 단순 Rule Match만 보는 것보다 **Application Context를 더 많이 활용할 수 있는 구조**라는 점은 분명하다.

---

# Security Requirement를 조직 기준으로 정의할 수 있다

개인적으로 가장 중요한 기능 중 하나라고 본다.

Security Agent에는 **Security Requirement Pack**이라는 개념이 있다.

조직의 Security Standard를 Requirement로 정의해서 Design Review와 Code Review에 사용할 수 있다.

예를 들면:

```text
Production Storage는 Encryption 필수

Public S3 Bucket 금지

Admin API는 MFA 필요

Sensitive Data는 특정 Region 밖으로 나갈 수 없음
```

같은 기준이다.

즉 Agent에게:

```text
취약점 찾아줘
```

라고만 하는 것이 아니라:

```text
우리 조직 기준에서
위반되는 부분을 찾아줘
```

라고 할 수 있다.

이 차이가 꽤 크다.

Security Automation이 잘 되려면 결국 AI보다 먼저 **정책을 명확하게 정의해야 하기 때문**이다.

---

# Penetration Testing은 실제 Exploit 가능성을 본다

AWS Continuum의 Penetration Testing은 단순 Vulnerability Scan과는 조금 다르다.

Agent가 Target Application을 분석하고 여러 단계를 거쳐 실제 Exploit 가능성을 확인한다.

개념적으로는:

```text
Target
   ↓
Recon / Context
   ↓
Attack Planning
   ↓
Exploit Attempt
   ↓
Validation
   ↓
Confirmed Finding
```

이다.

이 부분이 중요한 이유는 Security Team에서 항상 나오는 질문 때문이다.

```text
이 취약점,
실제로 공격 가능한가?
```

Scanner는 Finding을 만들어낼 수 있지만 우선순위를 정하려면 Exploitability가 중요하다.

그래서:

```text
Finding
→ Validation
→ Prioritization
```

으로 이어지는 구조가 실제 운영에서는 더 의미가 있다.

---

# IDE에서 바로 Security Review도 가능하다

Security Review가:

```text
개발 완료
→ Security Team 전달
```

에서:

```text
개발 중
→ IDE에서 Security Feedback
```

으로 이동하는 것도 중요한 변화다.

IDE나 Coding Agent 환경과 연결되면 개발자가 Code를 작성하는 과정에서 Security Review를 같이 수행할 수 있다.

개념적으로는:

```text
IDE
 ↓
Security Agent
 ↓
Source Review
 ↓
Finding
 ↓
Developer Feedback
```

구조가 된다.

Security Review가 별도의 마지막 단계가 아니라 Development Loop 안으로 들어오는 셈이다.

---

# Finding보다 더 중요한 건 Context다

Security Tool을 운영하다 보면 가장 힘든 문제가 있다.

Finding이 너무 많아지는 것이다.

```text
100 Findings
```

이 있다고 해서 실제 Risk가 100개라는 뜻은 아니다.

예를 들어:

```text
Finding A
Severity: Critical
Internal Only
Compensating Control 있음

Finding B
Severity: High
Public Endpoint
Customer Data 접근 가능
```

이라면 단순 Severity만으로 A를 먼저 고치는 게 항상 정답은 아니다.

그래서 앞으로 Security Tool의 핵심 경쟁력은 단순 Detection Count보다:

```text
Business Context
Exploitability
Asset Importance
Exposure
Existing Controls
```

같은 Context를 얼마나 잘 결합하느냐가 될 가능성이 높다.

AWS Continuum도 이런 Context를 기반으로 Risk를 Prioritize하고 실제 Exploitability를 검증하는 방향으로 확장되고 있다.

---

# 결국 Security Engineer의 역할은 어떻게 바뀔까?

Agent가 Scan, Triage, Fix Suggestion까지 해주면 처음에는 사람이 할 일이 줄어드는 것처럼 보인다.

하지만 실제로는 역할이 이동하는 것에 가깝다.

예전:

```text
Tool 실행
Finding 확인
Report 작성
Developer 전달
```

앞으로:

```text
Security Requirement 정의
        ↓
Agent Scope 설정
        ↓
Finding 검증
        ↓
Business Risk 판단
        ↓
Remediation Review
        ↓
Priority 결정
```

특히 중요한 부분은 **검증**이다.

AI가:

```text
Critical Vulnerability
```

라고 했을 때 왜 Critical인지 이해해야 한다.

AI가 Fix PR을 만들었다고 해도:

```text
Security Fix
    ↓
Performance 영향?
Backward Compatibility?
Business Logic 영향?
```

을 사람이 확인해야 한다.

Remediation이 자동화되더라도 Production Code에 대한 Review와 Test가 사라지는 것은 아니다.

---

# 가격 구조도 Agent답다

Penetration Testing은 일반적인 Scan 횟수 기반이 아니라 **task-hour** 기준으로 과금된다.

여기서 중요한 점은 task-hour가 실제 Wall Clock Time과 같지 않을 수 있다는 점이다.

여러 Task가 병렬로 실행되면 누적 Task Time으로 계산될 수 있다.

그래서:

```text
실제 테스트 시간
        ↓
여러 Agent Task 병렬 실행
        ↓
누적 Task Hour
```

로 보는 편이 맞다.

Pentest를 실제 운영에 넣는다면 Scope와 Test 대상을 얼마나 잘 제한하느냐가 비용 관리에서도 중요하다.

---

# 이걸 기존 AppSec Tool의 대체제로 봐야 할까?

나는 바로 그렇게 보지는 않을 것 같다.

처음 도입한다면:

```text
기존 SAST / SCA / DAST
        +
AWS Security Agent
```

처럼 병행해서 결과를 비교하는 게 현실적이다.

확인하고 싶은 건 다음이다.

```text
기존 Tool 대비
False Positive가 얼마나 줄어드는가?

기존 Tool이 못 찾던 Business Logic Risk를 찾는가?

실제 Exploit Validation 품질은 어떤가?

Remediation Code 품질은 어느 정도인가?

Cost 대비 Pentest Coverage가 얼마나 늘어나는가?
```

이 데이터를 보고 점진적으로 역할을 옮기는 편이 안전하다.

---

# 정리

AWS Security Agent를 단순한 AI Scanner라고 보면 기능을 절반만 보는 것 같다.

핵심은:

```text
Design
   ↓
Threat Modeling
   ↓
Code Review
   ↓
Penetration Testing
   ↓
Validation
   ↓
Remediation
```

을 하나의 Context 안에서 연결하려는 데 있다.

그리고 이 구조가 자리 잡으면 Security Engineer의 역할도:

```text
취약점을 직접 찾는 사람
```

에서:

```text
Security Policy를 정의하고
Agent가 찾은 Risk를 검증하고
우선순위를 결정하는 사람
```

으로 조금씩 이동할 가능성이 높아 보인다.

AI가 Security Testing을 빠르게 해줄수록 결국 더 중요해지는 것은 **어떤 Risk가 진짜 중요한지 판단하는 능력**일 것 같다.

---

## References

- [AWS Continuum](https://aws.amazon.com/continuum/)
- [AWS Security Agent User Guide](https://docs.aws.amazon.com/securityagent/latest/userguide/what-is-security-agent.html)
- [AWS Security Agent - How it works](https://docs.aws.amazon.com/securityagent/latest/userguide/how-it-works.html)
- [AWS Security Agent - Security requirements](https://docs.aws.amazon.com/securityagent/latest/userguide/security-requirements.html)
- [AWS Security Agent - Code review](https://docs.aws.amazon.com/securityagent/latest/userguide/perform-code-review-scan.html)
- [AWS Continuum Pricing](https://aws.amazon.com/continuum/pricing/)

---

관련 글:

- [SIEM이란 무엇인가: 로그 수집부터 탐지와 대응까지](/posts/what-is-siem/)
- [AWS 인프라로 SIEM 만들기: Security Lake와 OpenSearch](/posts/aws-siem-security-lake-opensearch/)
