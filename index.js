const { context } = require("@opentelemetry/api");
const { logs, SeverityNumber } = require("@opentelemetry/api-logs");
const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
app.use(express.json());
const port = 3000;
let db;
const logger = logs.getLogger("todo-service");

const startServer = async () => {
   const client = await MongoClient.connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/");
   db = client.db("todo");

   const seedTodos = [
       {
           id: "1",
           title: "Buy groceries"
       },
       {
           id: "2",
           title: "Install Aspecto"
       },
       {
           id: "3",
           title: "buy my own name domain"
       },
   ];
   await db.collection("todos").bulkWrite(seedTodos.map((todo) => ({
       updateOne: {
           filter: { id: todo.id },
           update: { $setOnInsert: todo },
           upsert: true,
       },
   })));

   const server = app.listen(port, "127.0.0.1", () => {
       console.log(`Example app listening on port ${port}`);
   });

   const shutdown = () => server.close(async () => {
       try {
           await client.close();
           await require("./tracing").shutdown();
       } catch (error) {
           console.error(error);
           process.exitCode = 1;
       }
   });
   process.once("SIGINT", shutdown);
   process.once("SIGTERM", shutdown);
};

startServer().catch((error) => {
   console.error("Could not start the todo service", error);
   process.exitCode = 1;
});

app.get("/todo", async (req, res) => {
   const requestContext = context.active();
   const todos = await db.collection("todos").find({}).toArray();
   res.once("finish", () => {
       logger.emit({
           context: requestContext,
           severityNumber: SeverityNumber.INFO,
           severityText: "INFO",
           body: "Listed todos",
           attributes: {
               "http.route": "/todo",
               "http.response.status_code": res.statusCode,
               "todo.item_count": todos.length,
           },
       });
   });
   res.send(todos);
});

app.get("/todo/:id", async (req, res) => {
   const todo = await db.collection("todos").findOne({ id: req.params.id });
   res.send(todo);
});
