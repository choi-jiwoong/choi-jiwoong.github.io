# observability-node

검증일: 2026-10-22

Node.js 24.19.0에서 `npm ci`, `node app.cjs`를 실행한 뒤 다른 터미널에서 `curl http://127.0.0.1:3000/orders/demo`를 호출한다. 응답, JSON 로그, ConsoleSpanExporter의 trace ID가 같은지 확인한다. Ctrl+C로 종료한다. 수동 Span과 stdout 로그 예제이며 Collector/OTLP 연동은 포함하지 않는다. 모든 요청을 샘플링하는 설정은 데모용이다.
