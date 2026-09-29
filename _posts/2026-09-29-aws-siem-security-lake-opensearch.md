---
title: "AWS 인프라로 SIEM 만들기: Security Lake와 OpenSearch"
description: "Amazon Security Lake를 보안 데이터 저장소로 두고 OpenSearch, Athena, Security Hub를 연결해 AWS에서 SIEM 구조를 만드는 방법을 정리했다."
date: 2026-09-29 13:20:00 +0900
categories: [AWS]
tags: [AWS, SIEM, SecurityLake, OpenSearch, OCSF, SecurityHub, CloudTrail]
---

SIEM을 직접 구성한다고 하면 처음에는 이런 구조를 생각하기 쉽다.

```text
CloudTrail
VPC Flow Logs
Application Logs
        ↓
    OpenSearch
        ↓
    Dashboard
```

물론 이것도 가능하다.

하지만 보안 로그가 많아지고 장기 보관까지 필요해지면 OpenSearch 하나가 Storage, Search, Dashboard, Detection, Long-term Retention 역할을 모두 담당하게 된다.

그래서 AWS에서는 조금 다르게 구성할 수 있다.

```text
Security Data
     ↓
Amazon Security Lake
     ↓
S3 / OCSF / Parquet
     │
     ├── Athena
     │
     └── OpenSearch
              ↓
         Detection
         Dashboard
         Investigation
```

핵심은 **Security Data Lake와 SIEM 분석 계층을 분리하는 것**이다.

---

# 전체 Architecture

```text
              AWS Accounts
                   │
      ┌────────────┼────────────┐
      │            │            │
 CloudTrail   VPC Flow Logs   WAF
 Route53      EKS Audit       Security Hub
      │            │            │
      └────────────┼────────────┘
                   ▼
          Amazon Security Lake
                   │
              OCSF / Parquet
                   │
                   ▼
                  S3
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
      Athena              OpenSearch
 Historical Query       Security Analytics
                              │
                     ┌────────┼────────┐
                     ▼        ▼        ▼
                  Search   Dashboard  Alert
```

이 구조에서 중심이 되는 서비스는 **Amazon Security Lake**다.

---

# Security Lake를 중심에 두는 이유

Security Lake는 AWS의 Security Data Lake 서비스다.

현재 AWS native source로 CloudTrail, EKS Audit Logs, Route 53 Resolver Query Logs, Security Hub CSPM Findings, VPC Flow Logs, WAFv2 Logs 등을 받을 수 있다.

그리고 데이터를 **OCSF(Open Cybersecurity Schema Framework)** 형식으로 Normalization하고 Apache Parquet 형태로 저장한다.

```text
CloudTrail ──────┐
VPC Flow Logs ───┤
Route53 ─────────┤
EKS ─────────────┼──→ OCSF
WAF ─────────────┤
Security Hub ────┘
```

SIEM에서 Normalization은 중요하다.

서비스마다 다른 Schema를 그대로 분석하는 것보다 공통 Schema를 사용하는 편이 Detection이나 Investigation에 훨씬 유리하기 때문이다.

---

# 왜 OpenSearch에 바로 넣지 않을까?

보안 로그는 양이 많다.

VPC Flow Logs, CloudTrail, WAF Logs, Application Logs 등을 몇 개월 또는 몇 년 저장하면 데이터가 빠르게 증가한다.

모든 데이터를 OpenSearch에 장기간 저장하면 검색은 편하지만 비용 부담이 커질 수 있다.

그래서 역할을 나눈다.

```text
Amazon S3 / Security Lake
→ 장기 저장
→ 원본 Security Data
→ Historical Investigation

OpenSearch
→ 빠른 Search
→ Dashboard
→ Detection
→ Alert
```

즉:

```text
Security Lake = Source of Truth
OpenSearch    = Analysis Layer
```

로 보는 것이다.

---

# OCSF

이 Architecture에서 생각보다 중요한 것이 OCSF다.

보안 로그는 서비스마다 형태가 다르다.

```text
CloudTrail
userIdentity
sourceIPAddress

WAF
httpRequest
clientIp

Authentication
user
ip
```

이런 데이터를 각각 처리하면 Detection Rule도 서비스별로 계속 만들어야 한다.

OCSF는 보안 Event를 공통 Schema로 표현한다.

개념적으로는:

```text
Authentication
Network Activity
API Activity
Security Finding
```

같은 Event Class로 통일하는 것이다.

그래서 장기적으로는 Service 중심 분석보다 Event 중심 분석으로 이동하기 쉬워진다.

---

# OpenSearch 연결 방법

Security Lake 데이터를 OpenSearch에서 사용하는 방법은 크게 두 가지로 생각할 수 있다.

## 1. OpenSearch Ingestion

실시간에 가까운 Detection이 필요한 데이터는 OpenSearch에 넣는다.

```text
Security Lake
      ↓
OpenSearch Ingestion
      ↓
OpenSearch Index
      ↓
Dashboard / Detection / Alert
```

OpenSearch Index에 데이터가 있기 때문에 빠르게 검색하고 Dashboard를 만들기 좋다.

예를 들어 Console Login Failure, IAM Policy Change, WAF Attack, Suspicious IP처럼 빠르게 확인해야 하는 Event에 적합하다.

## 2. Zero-ETL Direct Query

반대로 모든 데이터를 OpenSearch에 복제하지 않고 Security Lake에 있는 데이터를 직접 Query할 수도 있다.

```text
Security Lake
      │
      │ Zero-ETL
      ▼
OpenSearch Direct Query
      ↓
SQL / PPL
```

이 방식은 데이터를 별도 Index로 이동하지 않고 Security Lake에 있는 상태에서 조회할 수 있다.

그래서:

```text
평소에는 S3에 저장

필요할 때
↓
Investigation Query
```

같은 사용 방식에 잘 맞는다.

다만 Region과 기능 지원 범위는 바뀔 수 있으므로 실제 Architecture를 만들기 전에 지원 Region과 제약사항을 확인해야 한다.

---

# Athena도 같이 사용한다

Security Lake는 S3 기반 Data Lake이기 때문에 Athena를 이용한 Historical Query도 가능하다.

예를 들어 Incident가 발생한 뒤 특정 User의 지난 90일 활동이나 특정 IP 접근 기록을 조사할 수 있다.

```text
Security Lake
      ↓
Athena
      ↓
Historical Investigation
```

역할을 나누면 다음과 같다.

| 역할 | 서비스 |
|---|---|
| Security Data Lake | Amazon Security Lake / S3 |
| Schema | OCSF |
| Historical Query | Athena |
| Fast Search | OpenSearch |
| Dashboard | OpenSearch Dashboards |
| Detection | OpenSearch Security Analytics |
| Security Findings | Security Hub CSPM |
| IAM / API Audit | CloudTrail |

---

# Detection Flow

예를 들어 AWS Console 이상 접근을 탐지한다고 해보자.

```text
CloudTrail
    ↓
Security Lake
    ↓
OCSF
    ↓
OpenSearch
    ↓
Detection Rule
    ↓
Alert
```

Rule은:

```text
Console Login
+
Unknown IP
+
Failed MFA
```

같은 형태로 만들 수 있다.

여기에 다른 데이터를 연결하면:

```text
이상 로그인
     ↓
IAM 변경
     ↓
Security Group 변경
     ↓
S3 접근
```

같은 Timeline도 분석할 수 있다.

---

# Multi-Account라면

AWS 환경이 커지면 Account 하나만 보는 경우는 드물다.

```text
AWS Organizations
      │
 ┌────┼────┐
 │    │    │
Dev Stage Prod
 │    │    │
 └────┼────┘
      ▼
Security Account
      │
Security Lake
```

처럼 Security Account를 분리하는 것이 관리하기 좋다.

여기에 Delegated Administrator, Lake Formation, IAM, KMS, S3 권한 구조를 같이 설계해야 한다.

SIEM은 민감한 로그가 모이는 시스템이기 때문에 SIEM 자체의 접근 권한도 매우 중요하다.

---

# On-Premise나 SaaS까지 확장한다면

SIEM은 AWS 로그만 볼 필요는 없다.

```text
AWS ───────────┐
               │
On-Premise ────┼──→ OCSF
               │
SaaS ──────────┘
                    ↓
              Security Lake
                    ↓
          ┌─────────┴─────────┐
          ▼                   ▼
       Athena             OpenSearch
```

On-Premise의 Firewall, EDR, VPN이나 GitHub, Okta, Google Workspace 같은 SaaS 데이터도 Custom Source나 Integration을 통해 확장할 수 있다.

이 단계부터 Security Lake가 단순 AWS 로그 저장소가 아니라 **Organization Security Data Lake** 역할을 하게 된다.

---

# 모든 로그를 OpenSearch에 넣을 필요는 없다

처음 SIEM을 구성하면 모든 로그를 OpenSearch에 넣는 구조부터 생각하기 쉽다.

하지만 데이터가 커질수록 이 방식은 비싸고 운영도 어려워질 수 있다.

```text
전체 Security Data
        ↓
  Security Lake
        │
        ├──── Historical
        │       ↓
        │     Athena
        │
        └──── Hot Security Data
                 ↓
             OpenSearch
                 ↓
          Detection / Alert
```

**저장은 Data Lake가 담당하고, Search Engine은 정말 빠른 분석이 필요한 데이터에 집중시키는 구조**다.

---

# 정리

AWS에서 SIEM을 구성한다면 핵심은 OpenSearch 하나를 구축하는 것이 아니다.

```text
Collection
    ↓
Normalization
    ↓
Security Data Lake
    ↓
Detection / Search
    ↓
Investigation
```

AWS 서비스로 보면:

```text
CloudTrail
VPC Flow Logs
Route53
EKS
WAF
Security Hub
        ↓
 Amazon Security Lake
        ↓
   OCSF + S3
        │
   ┌────┴────┐
   ▼         ▼
Athena    OpenSearch
             │
        Detection
        Dashboard
        Alert
```

구조가 된다.

결국 이 Architecture에서 중요한 포인트는 **Security Lake를 보안 데이터의 Source of Truth로 두고, OpenSearch를 Detection과 빠른 Investigation을 위한 Analysis Layer로 사용하는 것**이라고 생각한다.

SIEM 자체의 개념부터 보고 싶다면 이전 글에서 정리했다.

← [SIEM이란 무엇인가: 로그 수집부터 탐지와 대응까지](/posts/what-is-siem/)