---
topic: ai
series: agent-design
series_order: 5
title: 'MCP로 연결했다고 모든 도구를 실행해도 될까'
description: '도서관 예약 도구를 예로 MCP 연결, 호출자 인증, Cedar 정책, 데이터 소유권 검사의 책임을 나누고 AgentCore Gateway 실습 코드의 한계를 살펴본다.'
date: 2026-11-19 04:48:00 +0900
categories: [AI]
tags: [Agent, MCP, AgentCore, Gateway, Cedar, Authorization]
---

도서관 에이전트가 예약 조회 도구를 발견했다. 입력에는 예약 번호 하나만 필요하다. 그러면 이용자가 입력한 다른 사람의 예약 번호도 조회해도 될까?

도구 이름과 입력 스키마는 호출 방법을 알려준다. 어떤 이용자의 예약을 읽어도 되는지는 서버가 판단해야 한다. [4편](/posts/agent-design-human-in-the-loop/)에서 사람의 검토를 기다리는 경계를 다뤘다면, 이번에는 호출이 실행 경계에 도착했을 때 적용할 권한을 살펴본다. 사례와 식별자는 모두 가상이다.

## 연결, 인증, 인가를 나눠 본다

| 경계 | 확인할 질문 | 도서관에서의 책임 |
|---|---|---|
| MCP 연결 | 어떤 도구가 있고 어떻게 호출하는가 | 도구 이름·설명·입력 스키마 제공 |
| 인바운드 인증 | 누가 Gateway를 호출하는가 | 토큰의 서명·발급자·수신 대상·만료 등 검증 |
| 도구 호출 인가 | 이 주체가 이 작업을 수행해도 되는가 | 역할, 도구, 입력 조건에 따른 정책 평가 |
| 아웃바운드 권한 | Gateway가 대상 시스템을 호출할 수 있는가 | 대상 Lambda 등에 부여한 실행 자격 관리 |
| 데이터별 인가 | 이 예약이 이 이용자에게 속하는가 | 저장된 소유 관계와 인증된 주체 대조 |

MCP에는 HTTP 기반 접근을 위한 인증·인가 사양이 있다. 그것을 도입한 뒤에도 예약 소유권 같은 업무 규칙을 구현해야 한다. 도구 검색으로 관련 함수가 나왔다는 사실이나 모델이 함수를 선택했다는 사실은 접근 허가를 대신하지 않는다. 프로토콜의 역할은 [MCP와 A2A 소개](/posts/mcp-a2a-tools-and-agents/)에서 더 살펴볼 수 있다.

## Lambda를 MCP 도구로 노출하는 데 필요한 것

김문주의 개인 공개 실습 저장소 `moonjukhim/AWS`의 `04_ToolsGateway_Demo.ipynb`를 확인했다. 확인한 `master` 커밋은 `fa0dbe6c80c3bf1d796cca6db45da59b2b31523d`다.

노트북은 Lambda 함수와 도구 스키마를 Gateway 타깃으로 등록한다. 이름·설명·입력 구조를 제공하고, Gateway가 MCP 호출을 받아 해당 Lambda로 전달하는 구성이다. 함수는 입력을 `event`에서 읽고, `context.client_context.custom["bedrockAgentCoreToolName"]`으로 도구를 구분한다.

도서관이라면 `lookup_reservation`과 `cancel_reservation`을 별도 도구로 등록하고, Gateway가 대상 함수를 호출할 권한을 갖게 할 수 있다. 조회와 취소는 서로 다른 정책을 적용한다. 기존 함수도 Gateway의 이벤트·컨텍스트 형식에 맞게 조정해야 할 수 있다. 노트북의 “코드 수정 없이”라는 소개보다 실제 Lambda 처리 코드와 공식 문서의 입력 형식을 함께 확인해야 한다.

이 글은 2026년 11월 19일의 공식 문서에서 Lambda 타깃, `CreateGatewayTarget`의 인증 설정, 정책 스키마와 적용 모드를 확인했다. 리소스 생성과 모델 호출은 실행하지 않았다.

## 이용자 토큰과 Lambda 실행 역할은 다르다

참고 노트북은 Runtime으로 받은 JWT를 Gateway에 전달하고, Gateway에서 JWT 기반 인바운드 인증을 구성한다. Gateway가 Lambda를 호출할 때는 별도로 구성한 IAM 실행 역할을 사용한다.

Gateway의 역할이 Lambda를 호출할 수 있어도, 모든 이용자의 예약을 읽을 권한이 생기는 것은 아니다. 대상 서비스가 인증된 이용자를 알 수 있도록 신뢰할 수 있는 전달 경로를 구성하고, 그 주체와 데이터의 소유 관계를 검사해야 한다. 모델이 도구 인자에 넣은 `member_id`를 그대로 인증된 이용자로 취급하면 공격자가 다른 값을 요청할 수 있다.

노트북의 JWT 디코딩 함수는 페이로드를 읽는다. 이 함수 자체가 서명을 검증하는 것은 아니다. 앞단의 인증 설정을 전제로 읽는 코드이므로, 별도의 공개 API로 옮길 때는 그 신뢰 경계부터 다시 구성해야 한다. 토큰을 전달할 때도 대상이 해당 토큰의 올바른 수신자인지 확인한다.

## Cedar 정책은 어떤 조건을 평가하는가

Cedar의 권한 요청은 주체 `principal`, 작업 `action`, 자원 `resource`, 추가 정보 `context`를 바탕으로 평가한다. 적용되는 `permit`이 있어야 허용되고, 적용되는 `forbid`가 있으면 거부된다.

AgentCore Gateway의 생성된 스키마에서는 도구가 작업이 되고 Gateway가 자원이 된다. 도구 입력은 `context.input`에서 다룬다. 예약 번호로 데이터베이스를 조회해 소유자를 알아내는 과정까지 이 입력 조건이 자동 수행하지는 않는다.

도서관 취소 정책에는 다음과 같은 조건이 필요할 수 있다.

- 로그인한 이용자에게 취소 도구 사용 권한이 있다.
- 예약이 그 이용자에게 속하고 현재 취소 가능한 상태다.
- 이미 수령 처리된 예약은 취소하지 않는다.
- 정책 예외가 필요한 경우에는 검토된 처리안과 현재 요청이 일치한다.

이 중 정적인 도구·역할·입력 조건은 Gateway 정책으로 표현할 수 있다. 데이터의 최신 상태와 소유 관계는 대상 서비스에서 신뢰할 수 있는 값으로 조회하고 검사한다. 역할을 나누면 정책 엔진이 받은 정보와 최종 데이터 검사의 책임을 추적하기 쉬워진다.

`ENFORCE` 모드는 평가 결과에 따라 호출을 허용하거나 거부한다. `LOG_ONLY`는 판정 기록을 남기지만 거부를 강제하지 않는다. Gateway를 우회하는 로컬 도구에는 그 Gateway 정책이 적용되지 않는다. 정책을 바꾸거나 적용 모드를 변경할 수 있는 관리 권한도 제한해야 한다.

## 참고 노트북에서 추가로 확인할 한계

원본의 프로필 조회는 입력된 고객 ID로 목 데이터를 반환한다. 조회 허용 정책은 특정 고객의 데이터 소유 관계를 대조하지 않는다. 환불 함수 역시 접수 결과 모양의 값을 생성하며, 실제 결제 시스템의 환불이나 주문 소유권 검사를 구현하지 않는다.

금액 정책은 입력 금액이 상한보다 작은지 확인한다. 그 조건만으로는 음수나 주문과 다른 금액까지 검증할 수 없다. 운영에서는 금액의 범위·통화·주문 잔액과 요청 소유자를 함께 확인해야 한다. 정책 등록 코드에는 검증 결과를 무시하는 모드로 재시도하는 부분도 있으므로, 배포 때는 검증 경고를 해결하고 의도한 스키마에 맞는지 확인한다.

저장소 루트와 해당 노트북에서 재사용 라이선스 표기를 확인하지 못했다. 원본 코드의 복사 대신 아래의 작은 예제를 별도로 작성했다.

## 데이터 소유권 검사를 작게 분리한다

아래는 예약 조회의 서버 측 검사 원리를 보여주는 Python 모의 예제다. `principal`은 서버의 인증 계층에서 확정한 값이라는 전제다. 모델이 전달한 인자에서 주체를 가져오지 않는다.

```python
RESERVATIONS = {
    "reservation-demo-1": {
        "owner": "reader-demo-a",
        "book": "별빛 여행",
    }
}


def lookup_reservation(principal, reservation_id):
    reservation = RESERVATIONS.get(reservation_id)
    if reservation is None or reservation["owner"] != principal:
        raise PermissionError("Reservation unavailable")
    return {"book": reservation["book"]}


assert lookup_reservation(
    "reader-demo-a", "reservation-demo-1"
) == {"book": "별빛 여행"}

try:
    lookup_reservation("reader-demo-b", "reservation-demo-1")
except PermissionError:
    pass
else:
    raise AssertionError("Cross-user access must be denied")
```

로컬에서는 본인 조회 허용과 다른 이용자의 조회 거부를 확인했다. 인증 서버·MCP 서버·Cedar 엔진을 실행한 검증은 포함하지 않았다. 실제 저장소에서는 인증된 주체 조건을 쿼리에 포함하고, 결과가 없을 때 예약 존재 여부를 다른 이용자에게 노출하지 않도록 응답을 설계한다.

쓰기 작업은 권한 검사 뒤에도 상태가 바뀔 수 있다. 취소 가능 여부 확인과 상태 변경을 원자적으로 처리하고, 재시도에는 멱등성 키를 적용한다. 감사 기록에는 요청 식별자, 도구, 정책 판정과 처리 결과를 남기되 토큰이나 불필요한 개인정보는 남기지 않는다.

연결이 성공한 뒤에는 허용·거부 사례를 함께 점검해야 한다. 본인 조회, 타인 조회, 토큰 누락·만료, 허용하지 않은 도구, 경계 입력, Gateway를 우회한 직접 호출을 각각 검사하면 어느 계층이 요청을 막는지 확인할 수 있다.

## 참고자료

- 김문주 — [개인 공개 실습 저장소의 04_ToolsGateway_Demo.ipynb](https://github.com/moonjukhim/AWS/blob/fa0dbe6c80c3bf1d796cca6db45da59b2b31523d/300-AI-MLAIDP-AdvGenAI/demo/04_ToolsGateway_Demo.ipynb)
- AWS — [AWS Lambda function targets](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-add-target-lambda.html), [CreateGatewayTarget API](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateGatewayTarget.html)
- AWS — [Set up inbound authorization for your gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-inbound-auth.html)
- AWS — [Schema constraints](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-schema-constraints.html), [Policy enforcement modes](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy-enforcement-modes.html)
- Cedar 프로젝트 — [Authorization](https://docs.cedarpolicy.com/auth/authorization.html)
- Model Context Protocol 프로젝트 — [Authorization, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
