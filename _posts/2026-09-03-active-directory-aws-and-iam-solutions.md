---
title: "Active Directory를 AWS에 연동해보니 IAM이 재미있어졌다"
description: "AD와 AWS 연동 경험을 계기로 Okta, Entra ID, IAM Identity Center, JumpCloud, Keycloak 등 대표 IAM 솔루션의 역할과 장단점을 정리해봤다."
date: 2026-09-03 20:15:00 +0900
categories: [IAM]
tags: [ActiveDirectory, AWS, Okta, EntraID, IAM, SSO, SCIM, Keycloak]
---

최근 외부 교육에서 **Active Directory를 AWS에 연동해서 사용하는 실습**을 해봤다.

평소 AWS를 사용하면서 IAM User, IAM Role, Policy 같은 것들은 많이 사용했지만, 회사의 사용자 계정과 AWS 계정을 연결해 중앙에서 관리하는 환경은 제대로 구성해본 적이 없었다.

교육에서는 Active Directory의 사용자와 그룹을 AWS에 연결하고, 해당 사용자에게 AWS 계정과 권한을 할당하는 과정을 직접 해봤다.

생각보다 재미있었다.

특히 이런 구조가 눈에 들어왔다.

```text
사용자
  │
  ▼
Active Directory
  │
  ▼
AWS IAM Identity Center
  │
  ├── Development Account
  ├── Staging Account
  └── Production Account
```

사용자가 AWS마다 별도의 계정을 가지는 것이 아니라,

**회사에서 사용하는 하나의 Identity를 기준으로 여러 AWS Account와 서비스의 접근 권한을 관리한다.**

AWS IAM Identity Center는 AWS Managed Microsoft AD 또는 자체 Active Directory를 Identity Source로 연결할 수 있고, 외부 IdP의 경우 SAML 2.0과 SCIM을 이용해 Okta나 Microsoft Entra ID 같은 제품과도 연결할 수 있다.

이걸 직접 사용해보니 자연스럽게 궁금해졌다.

> 회사 규모가 커지면 사용자 계정과 권한을 어떻게 관리할까?

그리고 예전부터 관심이 있었던 **Okta**를 시작으로 IAM 제품들을 조금 찾아보기 시작했다.

---

## 먼저 IAM이 뭘까?

IAM은 **Identity and Access Management**, 즉 Identity와 접근 권한을 관리하는 시스템이다.

쉽게 말하면 다음 두 가지 질문을 처리한다.

```text
Who are you?
누구인가?

What can you access?
무엇에 접근할 수 있는가?
```

조금 더 실제 회사 환경으로 바꾸면 이런 문제들이다.

```text
신입 개발자가 입사했다.

↓
Google Workspace 계정 생성
GitHub 계정 생성
Slack 초대
Jira 권한 부여
AWS Developer 권한 부여
VPN 계정 생성
Confluence 권한 부여
```

그리고 퇴사한다면?

```text
Google 계정 차단
GitHub 제거
Slack 제거
AWS 권한 제거
VPN 차단
...
```

서비스가 5개일 때는 사람이 관리할 수도 있다.

하지만 사용하는 SaaS가 50개, 직원이 1,000명이 되면 이야기가 완전히 달라진다.

그래서 Identity를 한 곳에서 관리하는 시스템이 중요해진다.

---

## IAM을 이해하기 전에 알아두면 좋은 용어

처음 IAM 제품들을 찾아보면 비슷한 단어가 계속 등장한다.

### Directory

사용자와 그룹 정보를 저장하는 곳이다.

대표적인 것이 Microsoft Active Directory다.

```text
User
Group
Computer
Organization Unit
```

같은 정보를 관리한다.

### IdP

**Identity Provider**.

사용자의 Identity를 확인하고 인증해주는 시스템이다.

예를 들어 서비스에 접속했는데

```text
Login with Microsoft
Login with Okta
Login with Google
```

같은 화면이 나온다면 해당 Microsoft, Okta, Google 등이 IdP 역할을 한다.

### SSO

**Single Sign-On**.

한 번 인증한 Identity를 사용해 여러 서비스에 접근하는 방식이다.

```text
          ┌── Slack
          │
Okta ─────┼── AWS
          │
          ├── GitHub
          │
          └── Jira
```

각 서비스마다 비밀번호를 따로 관리하지 않아도 된다.

### SAML / OIDC

SSO를 구현할 때 많이 사용하는 인증 프로토콜이다.

기업 SaaS 환경에서는 SAML을 많이 볼 수 있고, 현대적인 Web/Application 환경에서는 OAuth 2.0과 함께 OIDC를 자주 사용한다.

### SCIM

**System for Cross-domain Identity Management**.

로그인을 위한 프로토콜이라기보다 **사용자 Provisioning을 자동화하기 위한 표준**이다.

예를 들어 Okta에서 사용자를 만들었을 때:

```text
Okta

User Created
    │
    ├── Slack User Created
    ├── GitHub User Created
    └── AWS User Provisioned
```

반대로 사용자를 비활성화하면 연결된 시스템의 접근 권한도 함께 제거할 수 있다.

---

# 어떤 IAM 솔루션들이 있을까?

## 1. Microsoft Active Directory

기업 Identity 시스템 이야기에서 가장 먼저 등장하는 제품이다.

오랫동안 기업 내부의 Windows 환경에서 사실상 표준처럼 사용되어 왔다.

```text
Employee
   │
   ▼
Active Directory
   │
   ├── Windows Login
   ├── File Server
   ├── LDAP
   ├── Group Policy
   └── Internal System
```

### 장점

가장 큰 장점은 전통적인 기업 인프라와의 강력한 통합이다.

Windows PC, Windows Server, LDAP, Kerberos, Group Policy 같은 환경에서는 여전히 강력하다.

기존 회사가 이미 AD를 중심으로 구성되어 있다면 AWS나 SaaS 환경으로 Identity를 확장하는 것도 자연스럽다.

### 단점

근본적으로 On-Premise 중심으로 발전해온 기술이다.

Cloud SaaS와 모바일, Mac, Linux까지 범위가 넓어지면서 AD 하나만으로 모든 Identity를 관리하기에는 구조가 복잡해질 수 있다.

그래서 현대 환경에서는 AD 단독보다는 다른 Cloud Identity 플랫폼과 함께 사용하는 경우가 많다.

---

## 2. Microsoft Entra ID

예전 이름은 **Azure Active Directory**다.

이름 때문에 Active Directory의 Cloud 버전 정도로 생각하기 쉽지만, 실제로는 성격이 조금 다르다.

Entra ID는 Cloud 기반 Identity Provider에 가깝다.

```text
Active Directory
       │
       │ Sync
       ▼
Microsoft Entra ID
       │
       ├── Microsoft 365
       ├── Azure
       ├── AWS
       └── SaaS
```

### 장점

Microsoft 생태계와의 통합이 굉장히 강하다.

특히 회사에서 Windows, Microsoft 365, Teams, Azure, Intune을 많이 사용하고 있다면 자연스러운 선택이다.

기존 Active Directory를 가지고 있는 회사도 Hybrid Identity 형태로 확장하기 좋다.

### 단점

Microsoft 생태계 비중이 높아질수록 편해지는 대신 Microsoft 의존도도 자연스럽게 높아진다.

라이선스 구조와 Identity Governance, Conditional Access 같은 기능까지 들어가기 시작하면 처음 접하는 입장에서는 꽤 복잡하게 느껴질 수도 있다.

---

## 3. Okta

내가 개인적으로 가장 관심이 있었던 제품이다.

Okta는 대표적인 **Cloud Identity Provider**다.

특정 Cloud Vendor에 크게 종속되지 않고 다양한 SaaS와 Infrastructure를 연결하는 것을 목표로 한다.

```text
                  ┌── AWS
                  │
                  ├── Google Workspace
User ── Okta ─────┼── Microsoft 365
                  │
                  ├── Slack
                  │
                  ├── GitHub
                  │
                  └── Salesforce
```

단순 SSO뿐 아니라 Lifecycle Management, Identity Governance, Privileged Access, Workflow 같은 영역까지 제공한다.

### 장점

가장 큰 장점은 **Vendor Neutral**에 가까운 위치다.

AWS 회사에서도 사용할 수 있고 Azure 중심 회사에서도 사용할 수 있으며 Google Workspace 환경에서도 사용할 수 있다.

SaaS Integration이 많고 SSO, MFA, 사용자 Lifecycle 관리까지 Identity를 중심으로 묶을 수 있다.

특히 Multi Cloud 환경에서는 매력적이다.

```text
AWS
Azure
GCP
SaaS
Internal Application

        ▲
        │
      Okta
```

Identity가 Cloud보다 위에 존재하는 형태다.

### 단점

기능이 많아질수록 비용도 커질 수 있다.

그리고 이미 Microsoft 중심 환경이라 Entra ID가 충분한 회사라면 별도의 Okta를 도입하는 것이 오히려 시스템을 하나 더 운영하는 결과가 될 수도 있다.

---

## 4. AWS IAM Identity Center

AWS를 사용하는 개발자라면 가장 쉽게 접할 수 있는 서비스다.

예전 이름은 AWS SSO였다.

중요한 것은 IAM Identity Center를 Okta와 완전히 같은 종류의 제품이라고 생각하면 조금 다르다는 점이다.

IAM Identity Center는 특히 **AWS Account와 AWS Application 접근 관리에 강한 서비스**다.

AWS Organizations와 함께 사용하면

```text
AWS Organization

├── Management
├── Development
├── Staging
├── Production
└── Security
```

여러 Account에 사용자나 그룹별 Permission Set을 할당할 수 있다.

예를 들어:

```text
Developers
 ├── Dev        Administrator
 ├── Staging    PowerUser
 └── Production ReadOnly
```

같은 구조를 중앙에서 관리할 수 있다.

### 장점

AWS 환경에서는 굉장히 편하다.

특히 Multi Account 전략을 사용하면 효과가 크다.

AWS CLI 역시 SSO 인증을 사용할 수 있어서 Access Key를 개발자 PC에 장기간 저장하는 구조를 줄일 수 있다.

### 단점

Okta 같은 범용 Workforce Identity 플랫폼과 비교하면 역할의 범위가 다르다.

회사 전체 SaaS Identity를 관리하는 중앙 Identity Platform이라기보다는 **AWS 접근 관리의 중심**이라고 보는 것이 더 이해하기 쉽다.

그래서 실제 환경에서는 다음과 같은 구조를 고려할 수 있다.

```text
Okta
  │
  ▼
AWS IAM Identity Center
  │
  ▼
AWS Accounts
```

또는

```text
Entra ID
  │
  ▼
AWS IAM Identity Center
  │
  ▼
AWS Accounts
```

---

## 5. JumpCloud

조사하면서 꽤 흥미로웠던 제품이다.

JumpCloud는 Cloud Directory와 Device 관리까지 같이 가져가는 것이 특징이다.

```text
                JumpCloud

       Identity          Device
          │                │
    ┌─────┼─────┐     ┌────┼────┐
   AWS   SaaS   LDAP Windows Mac Linux
```

### 장점

Cloud Native 회사나 스타트업에서 흥미로운 선택지가 될 수 있다.

특히 Windows, Mac, Linux Device 환경이 섞여 있다면 전통적인 AD보다 자연스러운 구조를 만들 수 있다.

기존 AD와 연결해서 사용하다가 점진적으로 AD 의존도를 줄이는 구성도 고려할 수 있다.

### 단점

대규모 Windows Enterprise 환경에서는 이미 구축된 Active Directory 생태계를 완전히 대체하는 것이 현실적으로 쉽지 않을 수 있다.

반대로 Cloud First 조직에서는 굉장히 재미있는 선택지라고 생각한다.

---

## 6. Keycloak

앞의 제품들과 조금 다른 선택지다.

Keycloak은 **Open Source Identity and Access Management** 솔루션이다.

```text
Application
    │
    ▼
 Keycloak
    │
    ├── LDAP
    ├── Active Directory
    ├── Google
    ├── GitHub
    └── External IdP
```

OIDC, OAuth, SAML 등을 지원하고 외부 Identity Provider를 연결하는 Identity Brokering도 지원한다.

### 장점

가장 큰 장점은 직접 운영할 수 있다는 것이다.

특정 SaaS IAM Vendor에 모든 인증 시스템을 의존하고 싶지 않은 경우 좋은 선택지가 될 수 있다.

그리고 개발자 입장에서는 굉장히 재미있는 제품이다.

Authentication Flow나 Token, OAuth, OIDC 같은 Identity 기술을 직접 이해하기에도 좋다.

### 단점

직접 운영해야 한다는 것은 동시에 가장 큰 단점이다.

```text
HA
Database
Backup
Upgrade
Security Patch
Monitoring
Scaling
```

전부 우리의 책임이다.

Identity 시스템은 장애가 발생하면 회사의 모든 서비스 로그인이 동시에 막힐 수도 있다.

따라서 단순히 "SaaS 비용이 아까우니까 Keycloak을 쓰자" 정도로 결정할 문제는 아니다.

---

## 7. Ping Identity

Enterprise IAM 분야에서 오래된 강자 중 하나다.

특히 Hybrid 환경이나 기존 Legacy 시스템이 많은 대기업 환경에서 강점을 가진다.

### 장점

대규모 Enterprise와 복잡한 Hybrid 환경에서 강력하다.

Legacy Application부터 SaaS까지 Identity를 연결해야 하는 조직에서는 좋은 선택지가 될 수 있다.

### 단점

작은 조직이 가볍게 시작하기에는 다소 무거운 Enterprise 솔루션이다.

기능과 구성의 자유도가 높은 만큼 Identity Architecture에 대한 이해도 필요하다.

---

## Auth0도 IAM 아닌가?

IAM을 찾아보다 보면 **Auth0**도 거의 반드시 만나게 된다.

Auth0 역시 Identity 플랫폼이지만 앞에서 이야기한 Okta Workforce나 Entra ID와는 주 사용처가 조금 다르다.

쉽게 구분하면:

```text
직원 Identity

Okta
Entra ID
Ping
JumpCloud

------------------------

서비스 사용자 Identity

Auth0
Keycloak
Amazon Cognito
```

물론 실제 제품 기능은 이 정도로 깔끔하게 나뉘지는 않는다.

하지만 제품을 처음 이해할 때는 **Workforce IAM과 Customer IAM(CIAM)을 구분해서 보는 것이 편하다.**

예를 들어 회사 직원이 AWS에 로그인하는 것은 Workforce Identity 문제이고,

내가 만든 쇼핑몰에 고객이 Google 계정으로 로그인하는 것은 Customer Identity 문제에 가깝다.

---

# 한눈에 비교해보면

| 솔루션 | 성격 | 잘 맞는 환경 | 장점 | 단점 |
|---|---|---|---|---|
| Active Directory | Directory / Domain | 기존 Enterprise | Windows/Legacy 통합 | Cloud Native 환경에서는 복잡 |
| Entra ID | Cloud IAM / IdP | Microsoft 중심 기업 | M365/Azure 통합 | Microsoft 의존도 |
| Okta | Workforce IAM | Multi Cloud / SaaS | 많은 Integration, Vendor Neutral | 비용 |
| AWS IAM Identity Center | AWS Access | AWS Multi Account | AWS 권한 관리가 매우 편함 | 범용 IAM 역할은 제한적 |
| JumpCloud | Cloud Directory | Cloud Native / Mixed OS | Identity + Device 관리 | 대규모 AD 환경 전환 부담 |
| Keycloak | Open Source IAM | 자체 서비스 / Private 환경 | 자유도, Open Source | 운영 부담 |
| Ping Identity | Enterprise IAM | 대기업 / Hybrid | 복잡한 Enterprise 통합 | 구성과 비용이 무거울 수 있음 |
| Auth0 | CIAM / Application IAM | Web / Mobile 서비스 | Application 인증 구현 편리 | Workforce IAM과 목적이 다름 |

---

# 내가 지금 선택한다면?

결국 어떤 제품이 가장 좋다고 말하기는 어렵다.

**현재 회사가 어떤 환경인지가 훨씬 중요하다.**

### Microsoft 중심 회사

```text
AD
Microsoft 365
Windows
Azure
```

이라면 **Active Directory + Entra ID** 조합이 가장 자연스럽다.

### AWS 중심 회사

```text
AWS Organizations
Multi Account
Cloud Native
```

라면 우선 **AWS IAM Identity Center**부터 시작해볼 것 같다.

### SaaS와 Multi Cloud가 많은 회사

```text
AWS
Azure
GCP
Slack
GitHub
Notion
Jira
Google Workspace
```

이라면 **Okta** 같은 독립적인 Identity Platform이 매력적이다.

### Mac/Linux가 많고 AD가 없는 회사

Cloud Native 스타트업이라면 **JumpCloud**도 상당히 흥미로운 선택지다.

### 직접 Identity 시스템을 운영해야 한다면

**Keycloak**을 가장 먼저 검토해볼 것 같다.

다만 Identity 시스템 자체를 운영할 역량이 있는지를 먼저 고민해야 한다.

---

# 결국 중요한 것은 제품보다 Identity Architecture

이번에 Active Directory를 AWS에 연결해보면서 가장 흥미로웠던 부분은 특정 제품 자체가 아니었다.

예전에는 AWS 권한이라고 하면 자연스럽게 이런 것부터 생각했다.

```text
IAM User
IAM Role
IAM Policy
Access Key
```

그런데 조금 더 큰 조직의 관점에서 보면 시작점 자체가 다르다.

```text
HR
 │
 ▼
Identity
 │
 ├── Employee
 ├── Team
 ├── Department
 └── Role
 │
 ▼
Identity Provider
 │
 ├── AWS
 ├── GitHub
 ├── Slack
 ├── VPN
 ├── Kubernetes
 └── Internal Service
```

결국 핵심은

**"AWS 권한을 어떻게 줄까?"**

보다

**"이 사람은 누구이고, 어떤 조직에 속해 있으며, 어떤 Resource에 접근할 수 있어야 하는가?"**

에 더 가깝다.

그리고 한 단계 더 가면 IAM뿐 아니라

```text
IAM
│
├── SSO
├── MFA
├── Federation
├── Provisioning
├── IGA
│   └── Identity Governance
│
└── PAM
    └── Privileged Access Management
```

같은 영역으로 자연스럽게 확장된다.

DevOps를 하다 보면 Terraform, Kubernetes, AWS 같은 Infrastructure 기술에 집중하기 쉬운데 결국 이 모든 시스템의 입구에는 **Identity**가 있다.

그래서 앞으로는 AWS IAM뿐 아니라 Okta, Entra ID, Keycloak, IAM Identity Center 같은 제품들을 직접 구성해보면서 Identity Architecture를 조금 더 깊게 공부해보고 싶다.

개인적으로 다음에는 이런 구조를 한번 만들어보고 싶다.

```text
                Okta
                  │
              SAML / SCIM
                  │
                  ▼
        AWS IAM Identity Center
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
       Dev      Staging    Prod
        │
        ▼
   Permission Set
        │
        ▼
  Temporary Credentials
```

그리고 가능하다면 이 전체 구성을 Terraform으로 관리해보는 것.

아마 IAM 공부는 여기서부터 꽤 재미있어질 것 같다.

---

## 참고 자료

- [AWS IAM Identity Center - Active Directory](https://docs.aws.amazon.com/singlesignon/latest/userguide/manage-your-identity-source-ad.html)
- [AWS IAM Identity Center - External identity provider](https://docs.aws.amazon.com/singlesignon/latest/userguide/manage-your-identity-source-idp.html)
- [Microsoft Entra hybrid identity](https://learn.microsoft.com/en-us/entra/identity/hybrid/)
- [Okta Workforce Identity](https://www.okta.com/products/workforce-identity/)
- [JumpCloud Cloud Directory](https://jumpcloud.com/platform/cloud-directory)
- [Keycloak Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Ping Identity Workforce Identity](https://www.pingidentity.com/en/solution/workforce-identity.html)
