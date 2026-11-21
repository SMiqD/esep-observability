const express = require('express');
const { MongoClient } = require('mongodb');
const { context, metrics, trace } = require('@opentelemetry/api');
const { logs, SeverityNumber } = require('@opentelemetry/api-logs');
const { performance } = require('node:perf_hooks');

const app = express();
const client = new MongoClient(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017');
const port = Number(process.env.PORT || 3000);
const logger = logs.getLogger('todo-list');
const meter = metrics.getMeter('todo-list');
const requests = meter.createCounter('todo.requests', { unit: '{request}' });
const duration = meter.createHistogram('todo.request.duration', { unit: 'ms' });

async function startServer() {
  await client.connect();
  const todos = client.db('todo_lab').collection('todos');
  await todos.bulkWrite([
    {
      updateOne: {
        filter: { _id: 'review' },
        update: { $setOnInsert: { title: 'Review OpenTelemetry', done: true } },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { _id: 'trace' },
        update: { $setOnInsert: { title: 'Inspect a Jaeger trace', done: false } },
        upsert: true,
      },
    },
  ]);

  app.get('/todo', async (_req, res) => {
    const start = performance.now();
    const requestContext = context.active();
    const span = trace.getSpan(requestContext);
    let itemCount = 0;
    let error;

    res.once('finish', () => {
      const attributes = {
        'http.request.method': 'GET',
        'http.route': '/todo',
        'http.response.status_code': res.statusCode,
      };
      requests.add(1, attributes);
      duration.record(performance.now() - start, attributes);
      logger.emit({
        context: requestContext,
        severityNumber: error ? SeverityNumber.ERROR : SeverityNumber.INFO,
        severityText: error ? 'ERROR' : 'INFO',
        body: error ? 'Could not list to-do items' : 'Listed to-do items',
        attributes: error
          ? { ...attributes, 'error.type': error.name }
          : { ...attributes, 'todo.item_count': itemCount },
      });
    });

    try {
      const items = await todos.find().sort({ _id: 1 }).toArray();
      itemCount = items.length;
      res.json(items);
    } catch (err) {
      error = err;
      span?.recordException(err);
      res.status(500).json({ error: 'Could not list to-do items' });
    }
  });

  const server = app.listen(port, '127.0.0.1', () => {
    console.log('To-do API listening on http://127.0.0.1:' + port);
  });

  async function shutdown() {
    await new Promise((resolve) => server.close(resolve));
    await client.close();
    await require('./tracing').shutdown();
  }

  function stop() {
    shutdown().catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
  }

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

startServer().catch(async (err) => {
  console.error('Startup failed', err);
  await client.close();
  await require('./tracing').shutdown();
  process.exitCode = 1;
});
