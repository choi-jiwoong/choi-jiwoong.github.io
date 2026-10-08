---
title: "Terraform State는 왜 S3에 저장할까: Remote Backend와 Locking 이해하기"
description: "Terraform state를 local 파일로 두면 어떤 문제가 생기는지, S3 Remote Backend와 native state locking을 왜 사용하는지 운영 관점에서 정리했다."
date: 2026-10-08 09:05:00 +0900
categories: [DevOps]
tags: [Terraform, AWS, S3, IaC, DevOps, State, RemoteBackend]
---

Terraform을 처음 사용할 때는 별도 Backend 설정 없이도 잘 동작한다.

~~~bash
terraform init
terraform plan
terraform apply
~~~

그러면 같은 디렉터리에 terraform.tfstate가 생긴다.

처음에는 단순한 결과 파일처럼 보이지만, Terraform에서 state는 실제 Resource와 Terraform Code를 연결하는 핵심 데이터다.

~~~text
Terraform Code
      +
Current State
      +
Cloud Resource
      ↓
Difference 계산
      ↓
Plan
~~~

그래서 운영 환경에서는 **state를 어디에 저장하고 어떻게 보호할지**도 IaC 설계의 일부가 된다.

---

# Terraform State는 단순 Cache가 아니다

Terraform은 Resource를 만든 뒤 실제 ID와 속성을 state에 기록한다.

~~~text
aws_instance.app
    ↓
i-0123456789abcdef
~~~

다음 terraform plan에서는 Configuration, State, 실제 AWS Resource를 비교해 변경 사항을 계산한다.

~~~text
Configuration
     │
     ├── State
     │
     └── AWS Resource
            ↓
        Drift / Change
            ↓
           Plan
~~~

state를 잃어버리거나 여러 사람이 서로 다른 state를 사용하면 Terraform이 Infrastructure를 보는 기준도 달라진다.

---

# Local State의 문제

혼자 테스트할 때는 local state도 충분하다. 하지만 Team 환경에서는 금방 문제가 생긴다.

~~~text
Developer A
terraform.tfstate

Developer B
terraform.tfstate
~~~

각자 다른 state를 가지고 있다면 실제 Infrastructure는 하나인데 Terraform이 바라보는 상태는 두 개가 된다.

더 위험한 경우는 동시에 Apply하는 상황이다.

~~~text
Developer A ── terraform apply ──┐
                                 ├─ 같은 Infrastructure 수정
Developer B ── terraform apply ──┘
~~~

잘못하면 state가 서로 덮어써지거나 실제 Resource와 state가 어긋날 수 있다.

그래서 Team에서 Terraform을 운영할 때는 state를 중앙 저장소로 옮기는 것이 일반적이다.

---

# Remote Backend

Terraform에서 state 저장 위치를 담당하는 것이 **Backend**다.

기본값은 local backend다.

~~~text
Terraform
   ↓
terraform.tfstate
Local Disk
~~~

S3 backend를 사용하면:

~~~text
Developer ───────┐
                 │
GitHub Actions ──┼──→ Terraform
                 │        ↓
CI/CD ───────────┘    S3 Backend
                          ↓
                  terraform.tfstate
~~~

모든 실행 주체가 같은 state를 바라보게 된다.

---

# 왜 S3를 많이 사용할까?

AWS 환경에서는 S3가 Remote Backend로 잘 맞는다.

## 중앙 저장

~~~text
Developer A ────┐
Developer B ────┼──→ S3 State
GitHub Actions ─┘
~~~

Local File을 주고받을 필요가 없다.

## Versioning

S3 Bucket Versioning을 켜두면 state가 잘못 변경되었을 때 이전 버전을 확인하거나 복구할 수 있다.

HashiCorp도 S3 backend를 사용할 때 Bucket Versioning을 강하게 권장한다.

## IAM

State 접근 권한을 IAM으로 제한할 수 있다.

~~~text
Developer
→ Read

Terraform CI Role
→ Read / Write

Other Role
→ Deny
~~~

## Encryption

Terraform state에는 Resource 정보뿐 아니라 상황에 따라 민감한 값도 들어갈 수 있다.

그래서 S3 Server-Side Encryption과 필요하면 KMS를 같이 사용하는 것이 좋다.

---

# 2026년에는 DynamoDB Locking보다 S3 Lockfile

예전 Terraform 예제를 보면 이런 Architecture가 자주 나온다.

~~~text
S3
→ State

DynamoDB
→ State Lock
~~~

하지만 현재 Terraform S3 backend는 **S3 자체 Lockfile 방식**을 지원한다.

~~~hcl
terraform {
  backend "s3" {
    bucket       = "my-terraform-state"
    key          = "production/app/terraform.tfstate"
    region       = "ap-northeast-2"
    use_lockfile = true
  }
}
~~~

use_lockfile = true를 설정하면 Terraform이 state와 함께 Lockfile을 사용한다.

~~~text
terraform.tfstate
terraform.tfstate.tflock
~~~

현재 HashiCorp 문서에서는 DynamoDB 기반 locking을 **deprecated**로 표시하고 있다.

새 환경이라면 예전 예제를 그대로 복사해서 S3 + DynamoDB부터 만드는 것보다 S3 native locking을 먼저 검토하는 편이 맞다.

---

# Locking은 왜 필요할까?

Lock이 없다면 두 Pipeline이 같은 state를 동시에 수정할 수 있다.

~~~text
Pipeline A                Pipeline B
State Read                State Read
    ↓                         ↓
  Apply                     Apply
    ↓                         ↓
State Write               State Write
~~~

마지막 Write가 앞선 변경을 덮으면 state corruption으로 이어질 수 있다.

Locking을 사용하면:

~~~text
Pipeline A
Acquire Lock
     ↓
   Apply
     ↓
State Update
     ↓
Release Lock

Pipeline B
Acquire Lock
     ↓
    WAIT
~~~

처럼 한 번에 하나의 Writer만 state를 수정하게 된다.

Terraform은 backend가 locking을 지원하면 state를 쓰는 Operation에서 자동으로 Lock을 잡는다.

---

# S3 Backend 구성 예시

~~~hcl
terraform {
  backend "s3" {
    bucket       = "company-terraform-state"
    key          = "production/network/terraform.tfstate"
    region       = "ap-northeast-2"
    encrypt      = true
    use_lockfile = true
  }
}
~~~

환경별로 key를 분리할 수도 있다.

~~~text
company-terraform-state

development/
  network/terraform.tfstate
  application/terraform.tfstate

staging/
  network/terraform.tfstate

production/
  network/terraform.tfstate
  application/terraform.tfstate
~~~

중요한 것은 단순히 Bucket 하나에 state를 몰아넣는 것이 아니라 **경로와 IAM 권한을 Environment별로 나누는 것**이다.

---

# IAM 권한도 최소화한다

대표적으로 state 객체에는:

~~~text
s3:ListBucket
s3:GetObject
s3:PutObject
~~~

권한이 필요하다.

use_lockfile을 사용한다면 Lockfile에는:

~~~text
s3:GetObject
s3:PutObject
s3:DeleteObject
~~~

권한이 추가로 필요하다.

State 자체에 DeleteObject를 무조건 줄 필요는 없다.

~~~text
State
→ Read / Write

Lockfile
→ Read / Write / Delete
~~~

처럼 최소 권한을 설계할 수 있다.

---

# State를 Git에 올리면 안 되는 이유

terraform.tfstate를 Git에 Commit하는 것은 권장하지 않는다.

State에는 상황에 따라 Resource ID, Endpoint, IP, ARN, Configuration, Sensitive Value 등이 들어갈 수 있다.

sensitive = true는 CLI 출력 등을 숨기는 데 도움을 주지만 state에 값이 저장되는 경우까지 없애주는 기능은 아니다.

그래서 terraform.tfstate, terraform.tfstate.backup, .terraform/ 등은 Git에서 제외하고 state는 별도의 Remote Backend로 관리하는 편이 좋다.

---

# Local State를 S3로 옮기기

이미 Local State를 사용 중이라면 Backend 설정을 추가한 뒤 Migration할 수 있다.

~~~bash
terraform init -migrate-state
~~~

운영 환경에서는:

~~~text
현재 State Backup
        ↓
S3 Bucket / IAM 확인
        ↓
Backend 설정
        ↓
terraform init -migrate-state
        ↓
terraform plan
        ↓
변경 없음 확인
~~~

순서로 진행하는 편이 안전하다.

---

# 내가 권장하는 기본 구조

~~~text
               GitHub / Developer
                       │
                       ▼
                    Terraform
                       │
                       ▼
                S3 Remote Backend
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Versioning   Encryption    Lockfile
                                   │
                              use_lockfile
~~~

Environment가 커지면 Dev / Stage / Prod state와 IAM Role도 분리한다.

---

# 정리

Terraform State를 S3에 저장하는 이유는 단순히 파일을 Cloud에 백업하기 위해서가 아니다.

~~~text
Local State
    ↓
팀 공유 어려움
동시 실행 위험
복구 어려움

Remote Backend
    ↓
중앙 관리
Versioning
IAM
Encryption
Locking
~~~

2026년 기준으로 새 S3 backend를 설계한다면 **S3 + Bucket Versioning + Encryption + Least Privilege IAM + use_lockfile = true**를 기본으로 보고 시작하는 것이 좋다.

예전에 많이 사용하던 DynamoDB 기반 locking은 현재 deprecated 상태이므로, 기존 시스템을 유지하는 경우와 새 시스템을 만드는 경우를 구분해서 볼 필요가 있다.

---

## References

- [Terraform S3 Backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [Terraform State Locking](https://developer.hashicorp.com/terraform/language/state/locking)
- [Terraform Backends](https://developer.hashicorp.com/terraform/language/state/backends)
