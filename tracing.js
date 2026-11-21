const { resourceFromAttributes } = require('@opentelemetry/resources');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { AlwaysOnSampler, ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const {
   ConsoleMetricExporter,
   PeriodicExportingMetricReader,
} = require('@opentelemetry/sdk-metrics');
const {
   ConsoleLogRecordExporter,
   SimpleLogRecordProcessor,
} = require('@opentelemetry/sdk-logs');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

const traceExporter = process.env.TRACE_EXPORTER === 'console'
   ? new ConsoleSpanExporter()
   : new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
         || 'http://127.0.0.1:4318/v1/traces',
   });

const sdk = new NodeSDK({
   autoDetectResources: false,
   resource: resourceFromAttributes({ 'service.name': 'todo-service' }),
   sampler: new AlwaysOnSampler(),
   traceExporter,
   metricReader: new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 5000,
   }),
   logRecordProcessors: [
      new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
   ],
   instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new MongoDBInstrumentation(),
   ],
});

sdk.start();

module.exports = sdk;
