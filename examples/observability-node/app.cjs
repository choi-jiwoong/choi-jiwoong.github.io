const http = require('node:http');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { ConsoleSpanExporter, SimpleSpanProcessor, AlwaysOnSampler } = require('@opentelemetry/sdk-trace-base');
const { trace, SpanStatusCode } = require('@opentelemetry/api');

const sdk = new NodeSDK({
  serviceName: 'order-demo',
  autoDetectResources: false,
  sampler: new AlwaysOnSampler(), // Demo only: export every request.
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
sdk.start();
const tracer = trace.getTracer('order-demo');
const server = http.createServer((req, res) => {
  if (req.url !== '/orders/demo') { res.writeHead(404); res.end(); return; }
  tracer.startActiveSpan('GET /orders/demo', (span) => {
    try {
      const { traceId, spanId } = span.spanContext();
      console.log(JSON.stringify({
        event: 'order_received', service: 'order-demo',
        trace_id: traceId, span_id: spanId,
      }));
      span.setAttribute('demo.order_id', 'demo');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, trace_id: traceId }));
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR });
      res.writeHead(500); res.end();
    } finally { span.end(); }
  });
});
server.listen(3000, '127.0.0.1', () => console.log('Listening on 127.0.0.1:3000'));
process.on('SIGTERM', () => server.close(() => sdk.shutdown().then(() => process.exit(0))));
