# Fullstack CSV Import (Learning Project)

This is a production-style learning project built to practice backend architecture, not just CRUD.

Main feature: upload a CSV, process it, persist rows, and track task status transitions.

## Why this project exists

I’m using this repo to get hands-on practice with:

- TypeScript + NestJS
- TypeORM + PostgreSQL
- Status-driven workflows and error handling
- Streaming + batched CSV processing
- Worker/microservice split and queues (next stages)
- AWS basics (S3/SQS), plus CI/CD (next stages)

## Current status

Stage 1 (local end-to-end pipeline) is done and stable:

- `POST /imports/tasks` creates an import task (`created`)
- `PUT /imports/tasks/:taskId/file` uploads file (`uploaded`)
- `POST /imports/tasks/:taskId/process` processes CSV (`processing -> completed/failed`)
- `GET /imports/tasks` lists tasks

- DB-level guard for allowed processing transitions
- Upload transition guard (can’t upload from wrong status)
- Unknown errors mapped to 500, known Nest HTTP exceptions rethrown as-is
- Stream-based parsing with batch inserts

## System design (today)

- `backend`: NestJS API + processing logic
- `frontend`: React/Vite app (basic, evolving later)
- `postgres`: task/item persistence
- `redis`: prepared for queue-based stage

Processing currently runs inside the API service (Stage 1 choice).  
Stage 2 moves this to background worker + queue.

## Quick start

From repo root:

```bash
docker compose up -d
```

Backend:

```bash
cd backend
npm install
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## API quick demo

```bash
# 1) create task
curl -X POST http://localhost:3000/imports/tasks

# 2) upload csv file (replace TASK_ID + path)
curl -X PUT http://localhost:3000/imports/tasks/TASK_ID/file \
  -F "rawData=@./sample.csv"

# 3) trigger processing
curl -X POST http://localhost:3000/imports/tasks/TASK_ID/process

# 4) inspect tasks
curl http://localhost:3000/imports/tasks
```

## Testing

Backend tests:

```bash
cd backend
npm test
```

There are focused tests around import task service behavior (status guards and exception mapping), and this will be expanded in Stage 2.

## Roadmap

- Stage 2: queue + worker split (real async architecture)
- Stage 3: AWS integration (S3 + SQS, IAM basics)
- Stage 4: CI/CD + deployment (ECS/EC2), health checks, migrations
