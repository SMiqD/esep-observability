# A9 Observability

The starter Express app reads three sample to-do items from MongoDB. OpenTelemetry records HTTP, Express, and MongoDB spans. The app also exports request metrics and structured logs to the terminal.

## Run locally

Install Node.js and start Docker Desktop. From the project directory, run these commands in PowerShell:

```powershell
npm ci
docker run -d --name a9-mongo -p 127.0.0.1:27017:27017 mongo:7.0.16
docker run -d --name a9-jaeger -p 127.0.0.1:16686:16686 -p 127.0.0.1:4318:4318 jaegertracing/jaeger:2.5.0
```

To check console spans first, start the app with the console exporter:

```powershell
$env:TRACE_EXPORTER = 'console'
npm start
```

In a second terminal, call the endpoint:

```powershell
curl.exe -i http://localhost:3000/todo
```

Stop the app with Ctrl+C. In its terminal, switch back to OTLP export and restart:

```powershell
Remove-Item Env:TRACE_EXPORTER -ErrorAction SilentlyContinue
npm start
```

Call the endpoint again. Open [Jaeger](http://localhost:16686/), choose **todo-service** under **Service**, and click **Find Traces**. Open a **GET /todo** result to see the HTTP request, the Express route, and the MongoDB query in one timeline. Give the trace exporter a few seconds to send its batch.

For bash or zsh, use `TRACE_EXPORTER=console npm start` for the first run, `npm start` for the OTLP run, and `curl` in place of `curl.exe`.

Call `http://localhost:3000/todo/2` to exercise the starter’s single-item route.

## Telemetry

- **Traces** go to Jaeger over OTLP/HTTP at `http://127.0.0.1:4318/v1/traces` by default.
- **Metrics** include the HTTP server duration histogram and MongoDB connection pool measurements. The app exports them to the terminal every five seconds.
- **Logs** record the result of each completed list request, including its trace ID and the number of items returned on success.

Once finished, stop the app with Ctrl+C and run `docker stop a9-mongo a9-jaeger`. Use `docker start a9-mongo a9-jaeger` to run the same containers again.
