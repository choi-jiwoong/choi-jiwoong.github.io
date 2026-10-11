---
title: "Detection as Code — SIEM Rule도 Git으로 관리해야 하는 이유"
description: "SIEM 탐지 규칙을 Git에서 버전 관리하고 Sigma, 테스트, CI/CD, 배포 및 Rollback까지 연결하는 실무 설계."
date: 2026-10-11 12:10:00 +0900
categories: [Security]
tags: [Security, SIEM, DetectionAsCode, Sigma, GitOps, CICD, SOC]
---

SIEM 운영에서 탐지 Rule을 UI에서만 수정하면 처음에는 편하다. 하지만 어느 순간 이런 질문이 생긴다.

- 누가 왜 탐지 조건을 바꿨는가?
- False Positive를 줄이려고 제외한 조건이 실제 공격도 놓치게 만들지는 않는가?
- 장애가 나면 이전 Rule로 어떻게 돌아가는가?

[SIEM의 수집·정규화·탐지 흐름]({% post_url 2026-09-29-what-is-siem %})을 정리하면서, 탐지 로직도 애플리케이션 코드처럼 다뤄야 한다고 느꼈다. 이것이 **Detection as Code**의 출발점이다.

## UI 설정이 아니라 변경 가능한 코드로 본다

```text
Detection Engineer
    ↓ Git branch / Pull Request
Rule YAML + fixtures + tests
    ↓ CI: validate / convert / replay
Review + approval
    ↓ CD: stage → production
SIEM Detection Engine
    ↓ alert → triage → tuning feedback
Git PR (change history)
```

핵심은 Git에 파일만 보관하는 것이 아니다. **Rule의 의도, 변경 이유, 테스트 결과, 배포 버전**을 함께 추적하는 것이다. Git은 source of truth로 삼되, 실제 SIEM에 적용된 상태와 drift가 없는지도 확인해야 한다.

## Sigma를 쓰면 무엇이 좋아질까?

Sigma는 SIEM 탐지 로직을 YAML로 표현하는 범용 규칙 형식이다. `logsource`, `detection`, `condition` 등을 기술하고, 적절한 backend와 processing pipeline으로 대상 SIEM query로 변환한다.

아래는 **Windows process creation 로그에 CommandLine이 수집된다는 전제**의 교육용 예시다.

```yaml
title: Suspicious Encoded PowerShell Invocation
id: 3b6df681-55fb-4a21-90aa-1f6ecbb71e73
status: experimental
description: Detects PowerShell invocations with an encoded command argument.
logsource:
  product: windows
  category: process_creation
detection:
  selection_image:
    Image|endswith:
      - '\\powershell.exe'
      - '\\pwsh.exe'
  selection_command:
    CommandLine|contains:
      - ' -EncodedCommand '
      - ' -enc '
  condition: selection_image and selection_command
falsepositives:
  - Legitimate administrative automation
level: medium
```

이는 완성된 보안 정책이 아니다. 공격자는 인자 표기를 변형할 수 있고 정상 관리 도구도 encoded command를 사용한다. 실제 필드명, 대소문자 처리, 문자열 매칭 및 로그 수집 범위는 대상 환경에서 테스트해야 한다.

Sigma Rule을 SIEM에 그대로 업로드하면 항상 실행되는 것은 아니다. **Sigma → backend query 변환 → SIEM의 saved search / detection rule API 등에 등록 → schedule 및 alert action 설정**이라는 연결 단계가 필요하다. 플랫폼마다 배포 API와 실행 모델이 다르다.

## Repository 구조를 어떻게 잡을까?

```text
detection-rules/
├── rules/windows/encoded-powershell.yml
├── pipelines/production.yml
├── tests/
│   ├── positive/encoded-powershell.json
│   └── negative/admin-automation.json
├── deploy/
│   └── deploy_rules.py
└── .github/workflows/detection-ci.yml
```

Rule 옆에 positive/negative fixture를 두는 이유는 명확하다. 탐지를 넓히면 False Positive가 늘 수 있고, 탐지를 좁히면 True Positive를 잃을 수 있다. 둘 다 regression test가 필요하다.

## CI/CD는 최소 네 단계를 통과해야 한다

1. **Static validation**: YAML 파싱, Sigma schema 및 필수 metadata, 중복 ID, 허용된 logsource 확인
2. **Conversion test**: 대상 backend와 processing pipeline으로 query 생성; field mapping·index routing 확인
3. **Behavior test**: positive event는 탐지하고 negative event는 제외하는지 검증; 가능한 경우 실제 engine에서 replay
4. **Deployment gate**: 리뷰 승인 후 staging에 적용하고 실행 오류·alert volume 확인 뒤 production 반영

예시로 GitHub Actions의 기본 골격은 다음과 같다.

```yaml
name: detection-ci
on:
  pull_request:
    paths: ['rules/**', 'pipelines/**', 'tests/**']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install sigma-cli
      - run: sigma check rules/
      # 실제 backend plugin과 pipeline은 별도 설치·고정해야 한다.
      # conversion 및 fixture replay는 조직 환경에 맞게 추가한다.
```

위 예시는 CI 시작점일 뿐, 배포까지 자동으로 수행하는 완제품이 아니다. 실행 전 사용 중인 sigma-cli 버전에서 명령과 plugin 호환성을 검증하고 dependency를 pinning해야 한다. 운영 배포 credential은 Git에 넣지 않고 최소 권한의 secret 관리 방식을 사용한다.

## False Positive 튜닝은 PR로 남긴다

예를 들어 특정 관리 서버의 정기 작업이 매일 경보를 발생시킨다고 하자. 단순히 Rule을 끄기보다 다음을 남긴다.

- 어떤 alert와 raw event가 반복되는가?
- 제외 범위를 host, account, process 중 어디까지 좁힐 것인가?
- 예외가 공격자의 우회 경로가 되지 않는가?
- tuning 전후 alert volume, true-positive 사례, 놓친 사례는 무엇인가?

가능하면 **좁은 범위의 예외와 만료일**을 사용하고, 예외 케이스를 negative fixture로 추가한다. 정상 행위와 공격 행위가 같은 패턴을 공유한다면 단순 문자열 필터 대신 부모 프로세스, 사용자, 실행 위치 등 추가 context를 고려한다.

## Rollback과 Change History

Rule 배포 시 `rule_id → Git commit SHA → generated query → SIEM object ID` 매핑을 기록해 둔다. 변경 직후 경보 폭증이나 탐지 누락이 발생하면 이전 검증 버전의 산출물을 재배포한다.

Git revert만으로 운영 SIEM이 자동 복구되는 것은 아니다. **CD가 revert commit을 감지해 재배포하는지**, 삭제·비활성화된 Rule의 상태까지 reconcile하는지 확인해야 한다. 배포 후 rule count, enabled state, query checksum 같은 항목으로 drift를 점검한다.

## 실제 Detection Engine으로 연결하기

예를 들어 AWS 환경의 로그를 SIEM으로 분석한다면, 로그 수집·정규화와 탐지 Rule 배포는 별도 파이프라인으로 운영할 수 있다. 관련 구성은 [AWS Security Lake와 OpenSearch 기반 SIEM 글]({% post_url 2026-09-29-aws-siem-security-lake-opensearch %})에서 다뤘다.

```text
Cloud / Endpoint / Identity logs
       ↓ collection + normalization
SIEM indices / data streams
       ↑
Sigma YAML → conversion pipeline → backend query
       ↓
Rule deployment API → scheduled detection → alert
```

Rule이 정확해도 필드가 비어 있거나 ingest가 지연되면 탐지가 실패한다. 따라서 **Rule test뿐 아니라 telemetry coverage, ingest latency, alert delivery**까지 운영 지표로 확인해야 한다.

내가 처음 도입한다면 모든 Rule을 한꺼번에 이관하지 않는다. 변경 빈도가 높고 False Positive가 많은 Rule 몇 개를 골라 **Git PR → fixture test → staging → production → rollback drill**까지 한 사이클을 먼저 완성하겠다.

## 참고 자료

- [Sigma Rules Specification](https://sigmahq.io/sigma-specification/specification/sigma-rules-specification.html)
- [Sigma — Rules](https://sigmahq.io/docs/basics/rules.html)
- [Sigma — Processing Pipelines](https://sigmahq.io/docs/digging-deeper/pipelines.html)
- [Sigma CLI](https://sigmahq.io/docs/guide/getting-started.html)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
