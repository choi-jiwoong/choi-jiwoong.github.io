---
topic: cloud
title: "AWS Solutions Library Samples 둘러보기 — 9개 주제로 정리한 28개 프로젝트"
description: "생성형 AI부터 데이터 파이프라인, 보안, 비용 관리, 네트워크, 미디어와 산업별 시스템까지 공개 AWS 예제를 목적별로 분류하고 선택 기준을 정리한다."
date: 2026-10-29 13:00:00 +0900
last_modified_at: 2026-10-29
categories: [AWS, Architecture]
tags: [AWS, OpenSource, Architecture, Bedrock, DataEngineering, DevOps]
---

AWS 서비스를 개별적으로 공부하다 보면 “이 서비스들을 실제 시스템에서는 어떻게 연결할까?”라는 질문이 생긴다. 이때 참고할 만한 곳이 [AWS Solutions Library Samples의 공개 저장소 목록](https://github.com/orgs/aws-solutions-library-samples/repositories)이다.

저장소마다 다루는 문제와 구현 범위가 다르다. 에이전트 플랫폼도 있고, SQL 기반 ETL도 있으며, 게임 서버나 산업용 디지털 트윈도 있다. 이 글은 서비스 이름을 외우기 위한 목록보다 **해결하려는 문제에서 예제를 찾아가는 안내서**로 정리했다.

## 조사 범위와 읽는 방법

2026년 10월 29일 GitHub 공개 저장소 검색을 페이지별로 조회해 **중복 없는 352개 항목**을 확인했다. 여기에는 SDK, 보관된 프로젝트, 조직 설정용 저장소도 포함된다. 따라서 이 숫자를 서로 독립적인 완성 솔루션 352개라는 뜻으로 읽으면 안 된다.

그중 **대표 프로젝트 28개의 README를 확인해 9개 주제로 분류**했다. 아래 목록은 전체 저장소의 전수 코드 감사나 성능 순위가 아니다. 프로젝트가 설명하는 목적과 구성을 요약했으며, 실제 AWS 배포나 유료 모델 실행은 하지 않았다. 분류는 이 글의 탐색 편의를 위한 것이고 한 프로젝트가 여러 분야에 걸칠 수 있다.

전체 검색 결과의 저장소명·링크·기본 브랜치·archive 상태는 [조사 시점 목록 JSON](/assets/data/aws-solutions-library-repositories-2026-10-29.json)으로 함께 제공한다. 이 부록의 나머지 저장소까지 README를 모두 검토한 것은 아니다.

| 찾는 문제 | 먼저 볼 분야 |
|---|---|
| 에이전트를 배포하고 도구를 연결하고 싶다 | 생성형 AI·에이전트 플랫폼 |
| 문서를 읽거나 데이터에 자연어로 질문하고 싶다 | 문서 처리·RAG·자연어 조회 |
| 이벤트를 수집하고 분석 테이블로 옮기고 싶다 | 데이터 파이프라인 |
| 위협을 탐지하고 사고 증거를 확보하고 싶다 | 보안 탐지·사고 대응 |
| 비용과 운영 이벤트를 한곳에서 보고 싶다 | 비용 관리·운영·ChatOps |
| 계정 간 네트워크와 복구 절차를 설계하고 싶다 | 네트워크 자동화·재해 복구 |
| 영상 처리나 게임 서버 구조가 궁금하다 | 미디어·게임 |
| 장비와 설비의 상태를 연결하고 싶다 | IoT·디지털 트윈 |
| 특정 업무의 참조 구현이 필요하다 | 산업별 업무 시스템 |

## 1. 생성형 AI·에이전트 플랫폼

모델을 호출하는 코드에서 한 단계 더 나아가 인증, 도구 연결, 세션, 여러 모델의 접근 창구를 구성하는 분야다. 같은 AI 프로젝트라도 해결하는 계층이 다르다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [AgentCore 기반 멀티 에이전트](https://github.com/aws-solutions-library-samples/guidance-for-multi-agent-orchestration-using-bedrock-agentcore-on-aws) | Strands와 AgentCore Runtime·Gateway·Memory·Identity를 조합하는 예제 | 에이전트 실행과 인증·기억·관측을 함께 설계할 때 |
| [MCP 서버 배포](https://github.com/aws-solutions-library-samples/guidance-for-deploying-model-context-protocol-servers-on-aws) | Cognito OAuth 인증과 Streamable HTTP를 사용한 원격 MCP 서버 배포 | 기존 도구를 원격 에이전트에 제공할 때 |
| [다중 제공자 GenAI Gateway](https://github.com/aws-solutions-library-samples/guidance-for-multi-provider-generative-ai-gateway-on-aws) | LiteLLM을 ECS/EKS에 Terraform으로 배포하고 모델 접근과 사용량을 관리 | 여러 모델 제공자를 공통 인터페이스로 연결할 때 |

## 2. 문서 처리·RAG·자연어 데이터 조회

문서에서 구조화된 값을 추출하는 일, 문서를 근거로 답하는 일, 데이터베이스에 질의하는 일은 서로 다르다. 입력과 결과물부터 구분하면 선택이 쉬워진다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [GenAI 지능형 문서 처리](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws) | OCR와 생성형 AI를 결합해 비정형 문서를 구조화하고 검토·평가 흐름을 제공 | 문서 분류·필드 추출·사람 검토가 필요할 때 |
| [대화형 RAG 챗봇](https://github.com/aws-solutions-library-samples/guidance-for-conversational-chatbots-using-retrieval-augmented-generation-on-aws) | Kendra 검색, SageMaker 모델, Lex, DynamoDB 대화 기록을 LangChain으로 연결 | 검색·대화·생성의 연결 구조를 읽고 싶을 때 |
| [관계형 DB 자연어 질의](https://github.com/aws-solutions-library-samples/guidance-for-natural-language-queries-of-relational-databases-on-aws) | RDS PostgreSQL에 자연어로 질문하고 SQL과 질의 결과를 함께 반환 | Text-to-SQL의 구성과 결과 검증 지점을 살펴볼 때 |

## 3. 데이터 파이프라인·분석 기반

이 분야에서는 모델보다 수집 주기, 데이터 형식, 처리 엔진과 재처리 경계가 중요하다. 특히 증분 내보내기와 실시간 스트림을 같은 방식으로 이해하지 않아야 한다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [Clickstream Analytics](https://github.com/aws-solutions-library-samples/guidance-for-clickstream-analytics-on-aws) | 웹·모바일 이벤트를 수집하고 분석·시각화하는 파이프라인과 SDK | 방문·행동 데이터를 AWS 계정에서 처리할 때 |
| [S3에서 S3 Tables로 이전](https://github.com/aws-solutions-library-samples/guidance-for-migrating-tabular-data-from-amazon-s3-to-s3-tables) | Glue Catalog의 Hive·Iceberg 테이블을 Step Functions와 EMR Spark로 이전 | 테이블 형식과 카탈로그를 포함한 마이그레이션을 검토할 때 |
| [DynamoDB → S3 증분 내보내기](https://github.com/aws-solutions-library-samples/guidance-for-incremental-data-exports-from-amazon-dynamodb-to-amazon-s3) | 두 시점 사이의 변경 데이터를 주기적으로 S3에 내보내는 워크플로 | 분 단위 배치 증분 추출을 설계할 때 |
| [Spark on EKS SQL 기반 ETL](https://github.com/aws-solutions-library-samples/guidance-for-sql-based-etl-with-apache-spark-on-amazon-eks) | Arc 프레임워크와 Spark·EKS로 SQL 중심 ETL 및 배포 흐름 구성 | SQL 처리 정의와 컨테이너 실행 환경을 연결할 때 |

## 4. 보안 탐지·사고 대응

탐지 결과를 모으는 것과 사고 증거를 확보하는 것은 별도의 단계다. 보안 예제는 탐지 규칙뿐 아니라 권한과 증거 저장 경계까지 함께 읽는 편이 좋다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [EC2·EKS 포렌식 자동화](https://github.com/aws-solutions-library-samples/automated-forensic-orchestrator-for-amazon-ec2) | 영향받은 자원의 격리와 메모리·디스크 증거 확보 절차를 조율 | 침해 사고 대응 워크플로를 설계할 때; README의 EKS 범위는 EC2 기반 |
| [Falco와 Security Hub 연동](https://github.com/aws-solutions-library-samples/guidance-for-container-runtime-security-monitoring-with-cncf-falco-and-aws-security-hub) | 컨테이너 런타임 탐지 결과를 ASFF 형식으로 변환해 수집·통합 | 여러 클러스터의 보안 이벤트를 한곳에 모을 때 |
| [WAF 보안 자동화 — Terraform](https://github.com/aws-solutions-library-samples/security-automations-for-aws-waf-using-terraform) | 웹 방화벽 규칙과 자동화 구성의 과거 구현 예제 | 신규 도입 후보보다 구조 참고용: README에 deprecated 안내 |

## 5. 비용 관리·운영·ChatOps

여기에는 비용의 원인을 보여주는 대시보드, AWS 서비스 이벤트를 모으는 시스템, 장애 조사 에이전트가 있다. 모두 운영 도구이지만 답하려는 질문은 다르다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [Cloud Intelligence Dashboards](https://github.com/aws-solutions-library-samples/cloud-intelligence-dashboards-framework) | 비용·사용량 데이터를 Athena·QuickSight 등으로 분석하는 대시보드 프레임워크 | 계정·서비스별 비용과 사용 추세를 확인할 때 |
| [AWS Health Events Insight / HEIDI](https://github.com/aws-solutions-library-samples/aws-health-events-insight) | 여러 계정·리전·조직의 Health 이벤트를 수집하고 시각화·알림 제공 | 예정된 변경과 서비스 이벤트를 통합해서 볼 때 |
| [EKS Agentic AI ChatOps](https://github.com/aws-solutions-library-samples/eks-troubleshooting-agentic-ai-chatops) | Strands·EKS MCP·Slack을 연결하는 클러스터 문제 조사 예제 | 대화형 장애 조사와 도구 호출의 흐름을 살펴볼 때 |

## 6. 네트워크 자동화·재해 복구

네트워크 연결을 만드는 일, 연결 사이의 트래픽을 검사하는 일, 장애 후 데이터를 복구하는 일을 나누어 살펴볼 수 있다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [Transit Gateway 네트워크 오케스트레이션](https://github.com/aws-solutions-library-samples/network-orchestration-for-aws-transit-gateway) | 다중 계정·리전의 연결과 라우팅 변경을 자동화하고 승인·감사 UI 제공 | 태그 기반 네트워크 변경과 중앙 관리 흐름을 검토할 때 |
| [Network Firewall 교차 네트워크 검사](https://github.com/aws-solutions-library-samples/guidance-for-cross-network-traffic-inspection-with-aws-network-firewall) | 중앙 집중형 방화벽으로 VPC 사이의 트래픽 검사 환경 구성 | 검사 VPC와 트래픽 경로를 설계할 때 |
| [Aurora 재해 복구](https://github.com/aws-solutions-library-samples/guidance-for-disaster-recovery-using-amazon-aurora) | Aurora의 DR 구성·계획·시험 절차를 설명하는 가이드 | RPO·RTO 목표와 복구 시나리오를 구체화할 때 |

## 7. 미디어 처리·게임 인프라

동영상을 시청 가능한 형태로 만드는 파이프라인과 내용을 분석해 검색 가능한 자산으로 만드는 파이프라인은 목적이 다르다. 게임 분야에는 매치메이킹과 서버 할당까지 연결한 예제도 있다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [Video on Demand on AWS](https://github.com/aws-solutions-library-samples/video-on-demand-on-aws) | Step Functions·MediaConvert·MediaPackage를 활용한 VOD 처리 흐름 | 업로드된 영상을 변환·패키징하는 과정을 설계할 때 |
| [Media2Cloud](https://github.com/aws-solutions-library-samples/guidance-for-media2cloud-on-aws) | 영상·음성·이미지·문서를 수집하고 프록시·메타데이터·분석 결과 생성 | 미디어 자산의 수집과 분석 기반을 만들 때 |
| [Agones·Open Match 게임 서버](https://github.com/aws-solutions-library-samples/guidance-for-game-server-hosting-using-agones-and-open-match-on-amazon-eks) | EKS에서 매치메이킹과 게임 서버 플릿·할당을 연결 | 세션 기반 멀티플레이 게임 인프라를 이해할 때 |

## 8. IoT·디지털 트윈·제조

센서값을 모으는 것에 더해 자산 관계와 3D 장면을 연결하거나 상태를 예측하는 예제다. 시뮬레이터와 실제 장비 연동 범위를 구분해서 읽어야 한다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [산업용 디지털 트윈](https://github.com/aws-solutions-library-samples/guidance-for-industrial-digital-twin-on-aws) | IoT TwinMaker·SiteWise와 시뮬레이터로 생산 현장의 3D 모니터링 구성 | 설비 관계·알람·운영 상태를 시각적으로 연결할 때 |
| [배터리 디지털 트윈](https://github.com/aws-solutions-library-samples/guidance-for-battery-digital-twin-on-aws) | 배터리 건강 상태와 잔여 수명 예측을 위한 이벤트 기반 ML 흐름 | 구조 참고용: Amazon Forecast 신규 고객 제한을 README에서 확인 |

## 9. 산업별 업무 시스템

특정 산업의 프로젝트도 데이터 이동, 검색·추천 분리, 공유 실행 환경 같은 일반적인 설계 문제를 보여준다. 산업 이름보다 재사용할 수 있는 구성 요소에 주목해 볼 만하다.

| 프로젝트 · 공개 저장소 | 무엇을 구현하는가 | 살펴볼 상황 |
|---|---|---|
| [SAP 데이터 통합](https://github.com/aws-solutions-library-samples/guidance-for-sap-data-integration-and-management-on-aws) | AWS Glue에서 SAP RFC를 호출하고 결과를 S3로 추출 | OData 방식에 제약이 있는 SAP 연동을 검토할 때 |
| [Galaxy on AWS](https://github.com/aws-solutions-library-samples/guidance-for-galaxy-on-aws) | 생물정보학 중심의 분석 플랫폼 Galaxy를 EKS·EFS·Aurora 등으로 구성 | 분석 도구와 사용자 데이터·실행 환경을 함께 운영할 때 |
| [광고 실시간 입찰 시스템](https://github.com/aws-solutions-library-samples/guidance-for-building-a-real-time-bidder-for-advertising-on-aws) | 합성 데이터·부하 생성, 입찰 처리, 저장소와 관측 구성 | 저지연 요청 처리와 부하 시험 구조를 살펴볼 때 |
| [Bedrock Agents 개인화 추천](https://github.com/aws-solutions-library-samples/guidance-for-personalized-ecommerce-recommendations-using-amazon-bedrock-agents) | Amazon Personalize 추천과 OpenSearch 검색을 대화형 에이전트에 연결 | 검색·추천·대화의 역할을 나누어 설계할 때 |

## 비슷한 프로젝트는 무엇으로 구분할까

### AI Gateway, MCP 서버, AgentCore는 같은 역할이 아니다

다중 제공자 GenAI Gateway는 애플리케이션이 여러 모델에 접근하는 창구를 다룬다. MCP 서버 배포 예제는 에이전트가 사용할 도구를 원격으로 제공하는 데 초점이 있다. AgentCore 멀티 에이전트 예제는 실행 환경·인증·기억·관측을 묶어서 보여준다.

따라서 “게이트웨이가 필요하다”는 말만으로 저장소를 고르면 범위를 혼동하기 쉽다. **모델 요청을 중계할지, 도구를 노출할지, 에이전트 전체를 실행할지**부터 정하는 편이 좋다. 프로토콜 배경은 [MCP와 A2A의 차이](/posts/mcp-a2a-tools-and-agents/)에서 이어 읽을 수 있다.

### IDP, RAG, Text-to-SQL은 결과물이 다르다

문서 처리(IDP)의 주요 결과물은 추출된 필드와 구조화된 데이터다. RAG는 검색한 문맥을 바탕으로 답변을 만드는 흐름이다. Text-to-SQL은 실행할 질의와 데이터베이스의 결과를 다룬다.

예를 들어 가상의 도서관에서는 신청서의 이름·날짜를 추출하는 기능, 이용 규정에 답하는 기능, 월별 대출 건수를 조회하는 기능이 각각 다르다. 세 기능에 동일한 평가표를 적용하기보다는 추출 정확도, 답변 근거, 질의의 정확성과 접근 범위를 따로 확인해야 한다.

위 RAG 저장소는 **Kendra·SageMaker·Lex 기반 구성**이다. 기존에 다룬 [Bedrock RAG 실습](/posts/bedrock-rag-retrieve-and-generate/)과 동일한 구현으로 생각하면 안 된다. [RAG 기본 구조](/posts/rag-retrieval-grounded-generation/)를 기준으로 검색·생성·대화 저장의 역할을 비교하면 도움이 된다.

### 증분 Export와 스트리밍 CDC는 구분한다

DynamoDB 증분 Export 예제는 지정한 두 시점 사이의 변경을 주기적으로 내보낸다. 이를 개별 변경 이벤트가 곧바로 전달되는 스트리밍 CDC라고 소개하지 않는다. 허용 가능한 지연, 삭제 반영 방식, 구간 중복 처리와 재실행 기준이 요구사항에 맞는지 확인해야 한다.

S3 Tables 이전 예제 역시 단순 파일 복사보다 테이블 형식과 카탈로그를 함께 다룬다. 기존 테이블을 어디로 옮길지뿐 아니라, 이전 이후 어떤 엔진이 어떤 이름으로 읽을지도 살펴볼 부분이다.

## README에서 실제로 발견한 도입 조건

공개되어 있다는 사실과 지금 그대로 배포하기 적합하다는 사실은 다르다. 이번 조사에서도 다음처럼 구분할 사례가 있었다.

| 확인한 항목 | 원문에 명시된 내용 | 읽을 때의 의미 |
|---|---|---|
| WAF Terraform 자동화 | deprecated이며 추가 기능·업데이트를 제공하지 않는다고 안내 | 신규 도입의 기본 선택으로 제시하지 않고 AWS WAF 기본 기능을 함께 검토 |
| 배터리 디지털 트윈 | Amazon Forecast가 신규 고객에게 제공되지 않는다는 안내 | 새 계정에서 같은 구조를 그대로 재현할 수 있다고 가정하지 않기 |
| MCP 서버 배포 | MCP 2025-06-18 규격을 구현한다고 명시 | 현재 사용할 클라이언트·규격과의 호환성을 별도로 확인 |
| EKS ChatOps | 특정 AWS 블로그에 대응하는 코드는 별도 blog 브랜치라고 안내 | 읽는 문서와 체크아웃한 브랜치를 맞추기 |
| SAP RFC 연동 | SAP NetWeaver RFC SDK 다운로드에 SAP S-User가 필요하다고 설명 | README 공개 접근과 실습 의존성 확보 조건은 별개 |

이 표의 상태는 조사 당시 README에 근거한다. **archived 여부만으로 판단하지 않고 README의 중단 안내와 의존 서비스 조건도 함께 확인**했다. 예제에 제시된 비용과 처리량은 특정 시점·리전·설정의 가정이므로 이 글에서는 현재 비용이나 직접 측정한 성능으로 옮겨 적지 않았다.

## 프로젝트를 고른 뒤에는 이렇게 읽는다

먼저 README의 아키텍처 그림에서 입력, 처리, 저장, 결과 반환 경로를 찾는다. 그다음 배포 템플릿에서 실제 생성되는 자원과 권한을 확인한다. 특히 상시 실행 컴퓨팅, NAT Gateway, 검색 클러스터와 모델 엔드포인트가 포함되어 있다면 예제의 호출 횟수만으로 비용을 예상하기 어렵다.

이후에는 정상 실행 화면보다 **실패와 정리 절차**를 읽는다. 중간 작업이 실패하면 어디부터 재시도하는지, 같은 입력을 다시 넣으면 중복 결과가 생기는지, 삭제 명령이 데이터까지 지우는지 살펴본다. EKS 문제 조사나 포렌식처럼 실제 자원에 영향을 주는 프로젝트는 조회와 변경 권한을 구분해서 검토할 필요가 있다.

작게 시작하려면 전체 아키텍처를 한 번에 배포하기보다 필요한 구성 요소를 먼저 고른다. 예를 들어 문서 처리에서는 필드 추출과 검토 흐름을, 비용 분석에서는 기초 대시보드를, 게임 인프라에서는 매치메이킹과 서버 할당 인터페이스를 먼저 읽는 식이다. 이는 이 글에서 제안하는 접근 방법이며 각 저장소가 보장하는 운영 절차는 아니다.

## 기존 글과 연결해서 읽기

- [RAG: 검색한 근거로 답변 만들기](/posts/rag-retrieval-grounded-generation/) — RAG 프로젝트의 검색·생성 경계를 이해하는 배경
- [MCP와 A2A: 도구 연결과 에이전트 협업](/posts/mcp-a2a-tools-and-agents/) — 도구 서버와 에이전트 간 연결을 구분하는 배경
- [LLM-as-Judge](/posts/ai-search-keyword-model-benchmark-luna/) — 생성 결과를 평가할 때 점수의 의미와 한계를 살펴보는 배경
- [Harness Engineering](/posts/harness-engineering-ai-agents/) — 실행 환경, 권한, 검증과 종료 조건을 함께 보는 관점

## 참고자료

아래 자료와 각 표의 프로젝트 링크는 공개 웹자료다. 저장소 이름이 길기 때문에 표에는 짧은 설명명을 사용했으며, 링크는 실제 저장소로 연결한다.

- [AWS Solutions Library Samples — 공개 저장소 목록](https://github.com/orgs/aws-solutions-library-samples/repositories)
- [AWS Solutions Library](https://aws.amazon.com/solutions/)
- [AgentCore 멀티 에이전트 예제 README](https://github.com/aws-solutions-library-samples/guidance-for-multi-agent-orchestration-using-bedrock-agentcore-on-aws#readme)
- [GenAI 지능형 문서 처리 README](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws#readme)
- [Cloud Intelligence Dashboards README](https://github.com/aws-solutions-library-samples/cloud-intelligence-dashboards-framework#readme)
- [S3 Tables 이전 예제 README](https://github.com/aws-solutions-library-samples/guidance-for-migrating-tabular-data-from-amazon-s3-to-s3-tables#readme)
- [WAF Terraform 자동화 — 중단 안내](https://github.com/aws-solutions-library-samples/security-automations-for-aws-waf-using-terraform#readme)
- [배터리 디지털 트윈 — 서비스 의존성 안내](https://github.com/aws-solutions-library-samples/guidance-for-battery-digital-twin-on-aws#readme)

확인일: 2026년 10월 29일. 프로젝트의 지원 범위, 브랜치, 라이선스와 의존 서비스는 사용 시점의 원문을 다시 확인해야 한다.
