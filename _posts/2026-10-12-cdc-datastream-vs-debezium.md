---
title: "CDC는 왜 어려울까 — GCP Datastream vs Debezium"
description: "운영 DB의 변경 데이터를 BigQuery까지 옮길 때 마주치는 Snapshot, 중복, 순서, Schema Evolution, 장애 복구 문제와 Datastream·Debezium 선택 기준을 정리한다."
date: 2026-10-12 20:59:00 +0900
categories: [Data]
tags: [CDC, Datastream, Debezium, Kafka, BigQuery, DataEngineering]
---

운영 DB 데이터를 분석계로 옮긴다고 하면 처음에는 간단해 보인다. 주기적으로 SQL을 실행해서 BigQuery에 넣으면 되는 것 아닐까? 하지만 데이터량이 커지고 변경이 잦아지면 **무엇이 언제 바뀌었는지**를 안전하게 전달하는 일이 더 중요해진다.

관련 배경으로는 [추천 시스템의 MF와 Two-Tower 구조]({% post_url 2026-09-29-mf-vs-two-tower-recommendation-system %})에서 데이터 활용 관점을 다룬 적이 있다. 이번에는 그 앞단의 데이터 수집에 집중한다.

이번 글은 실제 구축 후기라기보다 **CDC 파이프라인을 설계할 때 확인할 기준**을 정리한 엔지니어링 노트다.

## CDC는 단순한 복사가 아니다

CDC(Change Data Capture)는 DB의 INSERT·UPDATE·DELETE 변경을 캡처해 다른 시스템에 전달하는 패턴이다. MySQL의 binlog, PostgreSQL의 WAL처럼 DB의 변경 로그를 읽는 log-based CDC가 대표적이다.

```text
[Operational DB]
  ├─ initial snapshot / backfill ──────────┐
  └─ transaction log → change events ──────┤
                                          ↓
                                 [Ingestion / Apply]
                                          ↓
                                 [BigQuery / Serving]
```

문제는 snapshot 중에도 운영 DB의 데이터가 바뀐다는 점이다. 초기 적재가 끝났다는 사실만으로 **어느 로그 위치부터 변경분을 이어받을지**, 중복 이벤트를 어떻게 처리할지 해결되지는 않는다.

## Datastream과 Debezium: 어디까지 직접 운영할까?

| 관점 | GCP Datastream → BigQuery | Debezium → Kafka → Sink |
|---|---|---|
| 성격 | Google Cloud 관리형 CDC 서비스 | 오픈소스 CDC 커넥터와 별도 스트리밍 인프라 조합 |
| 변경 데이터 전달 | Datastream이 지원하는 대상에 스트리밍 | Debezium 커넥터가 Kafka topic에 이벤트 발행 |
| 초기 적재 | Backfill 설정 및 대상 동기화 | Snapshot mode와 offset 관리 |
| 운영 부담 | 스트림·연결·대상 설정 중심 | Kafka Connect, broker, topic, sink, offset, schema history 등 |
| 확장성 | BigQuery로 빠르게 복제할 때 유리 | 여러 consumer가 동일 이벤트를 활용할 때 유연 |
| 주의점 | 대상 write mode와 테이블 제약 확인 | end-to-end 정합성·sink 적용 로직 직접 설계 |

Datastream의 BigQuery destination은 **Merge**와 **Append-only** write mode를 제공한다. Merge는 기본적으로 source primary key를 이용해 현재 상태를 반영하며, primary key가 없는 테이블은 append-only로 처리된다. Append-only는 변경 이벤트 이력을 보존할 때 적합하다. 반면 Debezium은 DB 변경을 Kafka event로 발행하므로, BigQuery 적재는 **별도의 sink 구성**이 필요하다.

## 1. Snapshot과 Streaming의 경계

MySQL용 Debezium connector는 초기 consistent snapshot을 수행한 뒤 기록한 binlog 위치부터 변경을 읽을 수 있다. 기본 `snapshot.mode`는 `initial`이다. 그러나 connector의 snapshot 성공과 downstream 테이블 정합성은 별개의 문제다.

설계할 때는 다음을 확인한다.

- 초기 적재 범위와 snapshot 기준 시점이 무엇인가?
- snapshot과 streaming 사이에서 누락되는 이벤트가 없는가?
- 재시작 후 이전 offset에서 이어받을 수 있는가?
- source log retention이 장애 복구에 충분한가?

특히 DB의 binlog/WAL이 먼저 정리되면 마지막 offset부터 재개할 수 없을 수 있다. 이 경우 재스냅샷이나 재동기화 계획이 필요하다.

## 2. 중복과 순서: Exactly-once를 쉽게 말하지 말자

네트워크 장애나 재시도 과정에서 동일한 변경이 다시 전달될 수 있다. 따라서 consumer가 단순히 `INSERT`만 수행하면 중복 행이 만들어질 수 있다.

```text
UPDATE order_id=42 status=PAID
  → event A → sink apply
  → acknowledgement lost
  → event A replay → sink apply again
```

내가 먼저 확인할 것은 **전송 계층의 보장**이 아니라 최종 테이블의 상태다. 변경 이벤트에는 가능한 한 primary key, operation, source position/sequence, event timestamp를 함께 보관한다. Sink에서는 event identity로 중복을 식별하고, key별 변경 순서를 고려한 idempotent upsert/delete를 설계한다. Timestamp 하나만으로 전체 순서를 판단하는 것은 위험하다.

Datastream의 BigQuery Merge mode는 이벤트 메타데이터와 내부 change sequence number를 활용해 변경을 적용한다. 그렇다고 모든 downstream 변환과 사용자 정의 집계까지 자동으로 exactly-once가 보장되는 것은 아니다.

## 3. BigQuery에서 현재 상태와 변경 이력은 다르다

예를 들어 주문의 상태가 `CREATED → PAID → CANCELLED`로 바뀌었다고 하자.

- **Current-state table:** 주문 1건의 최신 상태만 필요하다면 Merge 방식이 직관적이다.
- **Change history:** 상태 변경 이력과 전이 시간을 분석하려면 Append-only event를 보존해야 한다.

Datastream의 Append-only 모드에서는 INSERT, UPDATE-INSERT, UPDATE-DELETE, DELETE와 같은 이벤트를 기록한다. PK 변경도 삭제/삽입 형태로 표현될 수 있다. 반대로 Merge 모드는 이전 변경 이력을 남기는 용도가 아니다.

운영 테이블과 분석 목적을 분리하는 편이 안전하다. 필요하다면 **Raw CDC event → 정합성 검증 → Current-state mart / History mart**로 계층을 나눈다.

## 4. Schema Evolution은 컬럼 추가만의 문제가 아니다

운영 DB에 컬럼이 추가되거나 타입이 바뀌면 source capture, event serialization, sink mapping, downstream SQL 모두 영향을 받을 수 있다.

Debezium MySQL connector는 binlog의 DDL을 해석하고 schema history topic을 활용해 변경 시점의 스키마를 재구성한다. 이 history topic은 connector 내부용이므로 일반 consumer topic처럼 취급해서는 안 된다.

실무 체크리스트는 다음과 같다.

1. 컬럼 추가·삭제·rename·type 변경을 각각 테스트한다.
2. nullability와 default 값의 의미가 sink에서도 유지되는지 확인한다.
3. downstream SQL이 `SELECT *`에 의존하는지 점검한다.
4. 배포 순서를 `consumer 호환성 → source DDL` 관점에서 검토한다.
5. 변경 실패 시 재처리 범위와 되돌리기 절차를 문서화한다.

## 5. 장애 복구와 Backfill은 평상시에 연습해야 한다

```text
Alert: replication lag ↑
  ↓
Source DB / network / connector / sink 구간 분리
  ↓
Offset 및 log retention 확인
  ↓
일시 장애면 재개, 누락이면 범위 지정 backfill
  ↓
PK 기준 건수·checksum·표본 비교
  ↓
Lag 회복 및 downstream mart 재검증
```

무작정 connector offset을 지우는 것은 위험하다. Debezium의 schema history와 offset은 복구에 중요한 상태 정보이고, 초기화 방식에 따라 누락이나 대량 재처리가 발생할 수 있다. Backfill은 단순히 전체를 다시 복사하는 작업이 아니라 **어떤 범위를 어떤 시점 기준으로 재구축할지**를 결정하는 작업이다.

운영 지표도 단순한 connector up/down을 넘어야 한다.

| 지표 | 왜 필요한가 |
|---|---|
| Source-to-sink lag | 분석 데이터 신선도 확인 |
| Snapshot/backfill progress | 초기 적재와 복구 진행률 확인 |
| Failed/retried events | 장애와 중복 위험 감지 |
| Schema change failures | DDL 호환성 문제 조기 발견 |
| Source/sink reconciliation | 조용한 누락·불일치 탐지 |

## 그래서 무엇을 선택할까?

**운영 DB → BigQuery 복제가 주목적**이고 GCP 관리형 서비스의 제약이 요구사항과 맞는다면 Datastream을 먼저 검토하겠다. 반대로 변경 이벤트를 검색 인덱스, 캐시, 여러 서비스가 함께 소비하거나 세밀한 이벤트 처리가 필요하면 Debezium + Kafka 구성이 매력적이다. 다만 이 선택은 Kafka 운영과 Sink 책임까지 함께 가져온다는 의미다.

선택의 기준은 기술 이름이 아니라 **대상 시스템 수, 복구 목표, 데이터 정합성 요구, 운영 인력, 비용**이다. PoC에서는 정상 흐름보다 `snapshot 중 update`, `PK 변경`, `schema 변경`, `connector 재시작`, `sink 장애`, `로그 보존기간 초과`를 먼저 재현해 보는 것이 좋겠다.

다음 글에서는 **CDC 데이터 정합성을 어떻게 검증하고, 재처리·Backfill을 안전하게 수행할지** 더 깊게 살펴보려 한다.

## 참고 자료

- [Google Cloud — Configure a BigQuery destination](https://cloud.google.com/datastream/docs/configure-bigquery-destination)
- [Google Cloud — BigQuery destination](https://cloud.google.com/datastream/docs/destination-bigquery)
- [Google Cloud — Datastream FAQ](https://cloud.google.com/datastream/docs/faq)
- [Debezium — MySQL connector](https://debezium.io/documentation/reference/stable/connectors/mysql.html)
