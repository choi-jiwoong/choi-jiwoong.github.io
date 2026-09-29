---
title: "SIEM이란 무엇인가: 로그 수집부터 탐지와 대응까지"
description: "SIEM이 단순한 로그 저장소와 무엇이 다른지, Collection·Normalization·Correlation·Detection·Investigation 흐름을 기준으로 정리했다."
date: 2026-09-29 13:15:00 +0900
categories: [Security]
tags: [Security, SIEM, SOC, Detection, Log, IncidentResponse]
---

보안 시스템을 보다 보면 자주 등장하는 용어가 **SIEM**이다.

SIEM은 **Security Information and Event Management**의 약자다.

처음에는 단순히 보안 로그를 한곳에 모아보는 시스템 정도로 생각하기 쉽지만, 실제 역할은 조금 더 넓다.

```text
Log Collection
      ↓
Normalization
      ↓
Correlation
      ↓
Detection
      ↓
Alert
      ↓
Investigation
      ↓
Response
```

즉 SIEM의 핵심은 로그를 저장하는 것이 아니라, **여러 시스템에서 발생한 Event를 연결해서 보안 위협을 탐지하고 조사할 수 있게 만드는 것**이다.

---

# 왜 로그를 한곳에 모아야 할까?

회사에는 생각보다 많은 시스템이 있다.

```text
AWS
Firewall
VPN
EDR
Database
GitHub
Okta
Google Workspace
Kubernetes
Application
```

각 시스템은 모두 로그를 남긴다.

문제는 공격이 하나의 시스템에서만 발생하지 않는다는 점이다.

예를 들어:

```text
03:01  VPN 해외 IP 로그인
03:03  AWS Console 로그인
03:05  IAM Policy 변경
03:07  S3 데이터 접근
```

VPN 로그만 보면 단순 로그인일 수 있고, CloudTrail만 보면 IAM 변경일 수 있다.

하지만 여러 Event를 시간 순서로 연결하면:

```text
이상 로그인
    ↓
권한 변경
    ↓
민감 데이터 접근
```

이라는 하나의 Incident로 볼 수 있다.

이런 **Correlation**이 SIEM에서 중요한 역할이다.

---

# SIEM의 기본 구조

```text
Log Sources
    │
    ├─ Cloud
    ├─ Network
    ├─ Endpoint
    ├─ SaaS
    └─ Application
         │
         ▼
     Collection
         │
         ▼
   Normalization
         │
         ▼
   Central Storage
         │
         ▼
 Detection / Correlation
         │
         ▼
       Alert
         │
         ▼
   Investigation
```

각 단계의 역할을 나눠보면 SIEM이 단순한 로그 플랫폼과 무엇이 다른지 이해하기 쉽다.

## 1. Collection

가장 먼저 해야 할 일은 데이터를 모으는 것이다.

예를 들면 CloudTrail, VPC Flow Logs, Firewall Logs, EDR Events, Application Logs, Authentication Logs 등이 있다.

하지만 로그를 무조건 많이 모은다고 좋은 SIEM이 되는 것은 아니다.

로그가 많아질수록 Storage Cost, Search Cost, Noise, False Positive도 같이 증가한다.

그래서 먼저 **어떤 Event가 실제 Detection에 필요한지** 정의하는 것이 중요하다.

## 2. Normalization

로그를 모은 다음에는 각 서비스마다 다른 Schema를 맞춰야 한다.

예를 들어 로그인 Event만 보더라도:

```text
AWS
userIdentity
sourceIPAddress

Okta
actor
client.ipAddress

Application
user_id
remote_addr
```

처럼 필드가 다를 수 있다.

이 상태에서는 여러 시스템의 Event를 같이 분석하기 어렵다.

그래서 SIEM에서는 공통 Schema로 변환하는 **Normalization** 과정이 중요하다.

개념적으로는:

```text
AWS Login ───┐
Okta Login ──┼──→ Authentication Event
VPN Login ───┘

user
source_ip
device
timestamp
status
```

처럼 만드는 것이다.

AWS에서는 이런 문제를 해결하기 위해 Amazon Security Lake에서 **OCSF(Open Cybersecurity Schema Framework)**를 사용한다.

## 3. Detection

데이터가 정리되면 Detection Rule을 만들 수 있다.

가장 단순한 예는:

```text
Login Failed > 10
```

이다.

하지만 실제 Detection은 보통 더 많은 조건을 사용한다.

```text
같은 User
+
짧은 시간
+
여러 IP
+
서로 다른 Country
```

같은 조건을 조합할 수 있다.

또는:

```text
Console Login
    ↓
IAM Policy 변경
    ↓
CloudTrail 비활성화
```

처럼 여러 Event를 연결하는 Correlation Rule을 만들 수도 있다.

## 4. Alert와 False Positive

Detection Rule에 걸렸다고 해서 모두 공격은 아니다.

예를 들어 Login Failed 10회는 공격일 수도 있지만, 사용자가 비밀번호를 여러 번 잘못 입력한 것일 수도 있다.

그래서 실제 SIEM 운영에서 중요한 작업 중 하나가:

```text
Detection Rule
     ↓
Alert
     ↓
False Positive
     ↓
Rule Tuning
```

이다.

SIEM을 구축하는 것보다 **Detection 품질을 유지하는 것이 더 어려운 이유**이기도 하다.

## 5. Investigation

Alert가 발생하면 Security Analyst가 Event를 조사한다.

이때는 단순히 Alert 하나만 보는 것이 아니라:

```text
Who      사용자는 누구인가?
Where    어떤 IP / Region인가?
When     언제 발생했는가?
What     어떤 Resource에 접근했는가?
Context  전후에 어떤 Event가 있었는가?
```

를 함께 볼 수 있어야 한다.

그래서 SIEM에서는 Search와 Timeline 분석 기능도 중요하다.

---

# SIEM과 단순 로그 시스템의 차이

ELK나 OpenSearch에 로그를 넣었다고 바로 SIEM이 되는 것은 아니다.

```text
Central Logging
= 로그를 모아서 검색

SIEM
= 로그를 모아서
  정규화하고
  연결하고
  탐지하고
  조사하고
  대응
```

즉:

```text
Log Management
       +
Detection
       +
Correlation
       +
Investigation
       +
Incident Response
```

가 합쳐져야 SIEM다운 시스템이 된다.

---

# SOC와 SIEM

SIEM과 함께 자주 나오는 용어가 **SOC(Security Operations Center)**다.

둘의 관계는 이렇게 이해하면 쉽다.

```text
SIEM
= Tool / Platform

SOC
= People + Process + Tool
```

SIEM에서 Alert가 발생하면 SOC에서 Triage, Investigation, Incident 판단, Response를 수행한다.

좋은 SIEM을 구축했다고 해서 보안 운영이 자동으로 해결되는 것은 아니다.

운영 Process와 담당자가 같이 있어야 한다.

---

# 정리

SIEM의 핵심은 로그를 많이 저장하는 것이 아니다.

```text
Collect
   ↓
Normalize
   ↓
Correlate
   ↓
Detect
   ↓
Investigate
   ↓
Respond
```

결국 좋은 SIEM은 **모든 로그를 모으는 시스템이 아니라, 보안 사고를 빠르게 발견하고 이해할 수 있게 만드는 시스템**이라고 생각한다.

다음 글에서는 이 구조를 AWS 서비스로 옮겼을 때 Amazon Security Lake와 OpenSearch를 어떻게 나눠 사용할 수 있는지 정리한다.

→ [AWS 인프라로 SIEM 만들기: Security Lake와 OpenSearch](/posts/aws-siem-security-lake-opensearch/)