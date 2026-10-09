---
layout: post
title: "AWS VPC를 처음부터 설계한다면 — Public/Private Subnet, NAT, VPC Endpoint"
date: 2026-10-09 13:10:00 +0900
categories: [AWS, Networking]
tags: [AWS, VPC, Subnet, NAT Gateway, VPC Endpoint, ALB]
description: "2-AZ VPC의 public/private subnet, route table, NAT Gateway와 VPC Endpoint를 비용·운영 관점에서 설계한 실무 노트."
---

## VPC를 처음 설계할 때 먼저 묻는 질문

VPC CIDR을 고르기 전에 **무엇이 인터넷에서 들어오고, 무엇이 인터넷으로 나가야 하는가**를 먼저 그린다. 인터넷에서 접근 가능한 것은 ALB뿐인지, application은 outbound만 필요한지, database는 외부 연결이 전혀 필요 없는지부터 정해야 route table이 단순해진다.

예시로 `10.20.0.0/16`을 쓰는 2-AZ 구성을 생각해 보자. 실제 CIDR은 기존 VPC, VPN, 온프레미스, 향후 peering/TGW와 겹치지 않도록 정해야 한다.

```text
                       Internet
                          │
                         IGW
                          │
               Internet-facing ALB
                  /              \
            Public A           Public B
            10.20.0/24         10.20.1/24
               │                  │
            App A              App B
            Private A          Private B
            10.20.10/24        10.20.11/24
               │                  │
            DB A / DB B (isolated data subnets)
            10.20.20/24        10.20.21/24

    App outbound → NAT or VPC Endpoint → dependencies
```

## Public/Private는 subnet 이름이 아니라 route가 결정한다

Public subnet은 일반적으로 route table에 `0.0.0.0/0 → Internet Gateway`가 있는 subnet이다. **Public subnet에 있다는 이유만으로 instance가 인터넷에서 접근 가능한 것은 아니다.** Public IPv4 또는 IPv6 주소, Security Group, NACL 등 조건이 맞아야 한다.

| Subnet | AZ A | AZ B | IPv4 default route |
| --- | --- | --- | --- |
| Public | 10.20.0.0/24 | 10.20.1.0/24 | IGW |
| Private App | 10.20.10.0/24 | 10.20.11.0/24 | NAT (필요 시) |
| Isolated Data | 10.20.20.0/24 | 10.20.21.0/24 | 없음 |

VPC의 `local` route는 내부 CIDR 통신에 쓰인다. DB subnet에는 기본 인터넷 route를 두지 않고 app Security Group에서 필요한 port만 허용한다. ALB는 두 AZ의 public subnet에 배치하고 app target은 private subnet에 둔다. ALB의 Security Group은 443 inbound를 허용하되 app은 ALB Security Group에서 오는 트래픽만 받게 한다.

## NAT Gateway를 언제 둘까?

Private subnet의 workload가 외부 package registry, public API 등에 **IPv4 outbound**로 접근해야 한다면 NAT가 필요할 수 있다. NAT Gateway는 외부에서 임의로 들어오는 inbound 연결을 허용하는 장치가 아니다.

AWS는 전통적인 **Zonal NAT Gateway**뿐 아니라 **Regional NAT Gateway**도 문서화하고 있다. 따라서 예전처럼 'NAT는 반드시 AZ마다 하나'라고 단정하면 안 된다. Zonal 모델을 선택한다면 AZ별 NAT와 AZ별 route table을 매칭해 cross-AZ 의존과 데이터 전송 비용을 줄이는 편이 일반적이다. 하나의 Zonal NAT만 공유하면 비용은 낮출 수 있지만 해당 AZ 장애와 cross-AZ traffic에 취약해진다. Regional 모델은 지원 조건, 동작 방식, 가용성과 가격을 현재 AWS 문서에서 따로 검토해야 한다.

```text
Private App A ──► NAT A ──► IGW
Private App B ──► NAT B ──► IGW
```

**NAT 비용은 시간당 요금과 처리 데이터 요금**을 함께 봐야 한다. AZ 간 데이터 전송이나 public IPv4 비용도 별도로 발생할 수 있다. 트래픽이 작아도 항상 켜진 NAT가 비용을 지배할 수 있고, 트래픽이 커지면 per-GB 비용이 더 중요해진다.

## VPC Endpoint로 NAT 의존도를 줄인다

S3나 DynamoDB로 가는 트래픽은 **Gateway Endpoint**를 검토한다. 해당 endpoint를 연결한 route table에 서비스 prefix-list route가 추가되며, AWS 문서 기준 Gateway Endpoint 자체에는 추가 시간당·데이터 처리 요금이 없다. 대상 서비스의 일반 사용료는 별개다.

ECR API, ECR Docker, CloudWatch Logs, Secrets Manager, SSM 등은 **Interface Endpoint (AWS PrivateLink)**를 검토한다. Interface Endpoint는 ENI와 private IP를 사용하며 시간당·데이터 처리 요금이 발생한다. Private DNS, endpoint Security Group, endpoint policy, 서비스별 요구 endpoint 조합을 확인해야 한다. 특히 ECR image pull은 S3 layer 다운로드 경로까지 고려해야 한다.

```text
Private App ──► S3 Gateway Endpoint ──► S3
            ├─► Interface Endpoint ───► AWS APIs
            └─► NAT Gateway ──────────► Public Internet
```

**Endpoint를 추가한다고 모든 인터넷 트래픽이 자동으로 사라지지는 않는다.** 실제 DNS resolution, route, workload의 API 호출 경로를 관찰하고 NAT 처리량과 비용이 줄었는지 측정해야 한다. Interface Endpoint를 여러 AZ에 만들면 가용성에는 유리하지만 endpoint별 비용도 늘어난다.

## 내가 선택할 기본값

운영 서비스라면 우선 2-AZ 이상, internet-facing ALB는 public, app은 private, DB는 isolated subnet으로 나눈다. Security Group을 기본 방어선으로 사용하고, subnet별 route table은 명시적으로 관리한다. 외부 통신 요구를 목록화한 뒤 Gateway Endpoint부터 적용하고, Interface Endpoint는 호출량·가용성·비용을 보고 추가한다. NAT는 Zonal/Regional 모델을 비교해 선택한다.

작은 개발 환경은 단일 NAT 같은 비용 절감안을 고려할 수 있지만, **운영 환경의 장애 범위와 cross-AZ 비용을 문서화**하지 않은 채 그대로 복제하지 않는다. Terraform으로 subnet, route table, endpoint를 코드화하고, VPC Flow Logs와 비용 지표로 실제 경로를 검증한다.

VPC 설계의 핵심은 subnet 개수가 아니다. **트래픽 경로를 설명할 수 있고, 장애가 나도 어디까지 영향받는지 예측할 수 있는가**다.

## References

- [Amazon VPC: Subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html)
- [Amazon VPC: Route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html)
- [Amazon VPC: NAT gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)
- [Amazon VPC: Gateway endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html)
- [Amazon VPC: Interface endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html)
- [Elastic Load Balancing: Application Load Balancers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)
