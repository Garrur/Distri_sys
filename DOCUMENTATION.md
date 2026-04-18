# 🧠 Distributed Task Queue: Master Engineering Guide

A production-grade, high-performance distributed task queue system built with **TypeScript**, **Redis**, and **Fastify**. Designed for reliability, observability, and extreme scalability.

---

## 🏗️ 1. What is this Project?

### The Simple Version
Imagine a busy **Restaurant**.
*   **The Waiter (Queue)** takes your order and puts a ticket in the kitchen window.
*   **The Chefs (Workers)** grab tickets one by one and cook the food.
*   If a chef is too slow, or drops a plate (**Failure**), the head chef (**Watchdog**) notices and puts the order back in the window.

This project is that kitchen window. it allows different parts of a computer system to "order" work (like sending an email or processing a video) and ensures that work eventually gets done, even if a "chef" crashes.

---

## ❓ 2. Why This Project Exists

In modern web apps, some tasks are "heavy." If a user clicks "Sign Up" and your server spends 5 seconds sending a welcome email, the user thinks your site is broken.

**The Solution:**
1.  **Frontend** sends a "Sign Up" request.
2.  **API** instantly responds "Success!" and pushes an "Email Task" into the **Queue**.
3.  **Worker** picks up the task 10 milliseconds later and sends the email in the background.

This keeps your app fast and your users happy.

---

## 🚀 3. What Makes This Different?

| Feature | This Project | Standard SaaS / BullMQ |
| :--- | :--- | :--- |
| **Logic** | Custom Atomic Redis Patterns | Heavy abstractions |
| **Priority** | Native Multi-List `BRPOP` | Single-list sorting |
| **Aesthetics** | Editorial/Brutalist Monitoring | Generic SaaS Dashboard |
| **Transparency** | Raw visibility into Redis Keys | Hidden internals |

**Why build from scratch?**
By building directly on Redis primitives (`LPUSH`, `BRPOP`), we avoid the overhead of heavy libraries while maintaining absolute control over the **Heartbeat** and **Retry** mechanisms.

---

## 🏗️ 4. System Architecture

The system is composed of six distinct architectural components:

1.  **Queue (The Producer)**: Creates jobs and puts them into Redis.
2.  **Worker (The Chef)**: The logic that actually executes a task.
3.  **WorkerPool (The Kitchen)**: Manages many Workers simultaneously.
4.  **Scheduler (The Timer)**: Monitors "Delayed" jobs and moves them to "Active" when time is up.
5.  **Watchdog (The Guardian)**: Detects stalled workers via heartbeat expiry.
6.  **API (The Command Center)**: A REST interface for monitoring and manual control.

---

## 🔄 5. How It Works (Step-by-Step)

1.  **Creation**: `Queue.enqueue()` generates a unique UUID, saves the job data as a **Redis Hash**, and pushes its ID into a **Priority List**.
2.  **Pickup**: A worker is waiting on a **Blocking Pop (`BRPOP`)**. As soon as an ID arrives, it grabs it.
3.  **Heartbeat**: The worker sets a "Heartbeat" key in Redis with a short expiry (TTL). It renews this key every few seconds.
4.  **Execution**: The worker runs the code.
    *   **Success**: Job status updated to `completed`; stats incremented.
    *   **Failure**: Status changed to `failed`; **Exponential Backoff** calculates a delay; job is moved to the **Delayed Set**.
5.  **Finality**: If a job fails too many times, it enters the **Dead-Letter Queue (DLQ)** for human inspection.

---

## ⚙️ 6. Core Concepts (Deep Technical Insights)

### **A. Redis as a Message Broker**
We use **Redis Lists** as the transport. `BRPOP` is a "Blocking" command—the connection stays open and "sleeps" until work arrives. This is much more efficient than "polling" (asking "Is there work yet?" every second).

### **B. Priority Handling**
We maintain three lists: `queue:high`, `queue:normal`, and `queue:low`.
The command `BRPOP high normal low 0` tells Redis: *"Give me work from 'high' first. If 'high' is empty, look in 'normal'. If that's empty, look in 'low'."*

### **C. Decoupled Heartbeats**
Most systems use a TTL on the job itself. If the job is slow, it expires. **That is a bug.**
Our system uses a **Decoupled Heartbeat**:
*   The worker renews a separate `heartbeat:job_id` key.
*   The **Watchdog** only kills a job if the *heartbeat* stops (meaning the worker crashed), NOT if the *task* is just taking a long time.

---

## 🧩 7. Code Breakdown

*   **`Queue.ts`**: The entry point for adding work. Uses atomic pipelines to ensure data integrity.
*   **`WorkerPool.ts`**: The engine. Uses **N dedicated Redis connections** (one per worker) so that one blocking worker doesn't freeze the whole system.
*   **`Watchdog.ts`**: Uses `MGET` to batch-check hundreds of job heartbeats in one millisecond.
*   **`Scheduler.ts`**: Uses `ZRANGEBYSCORE` to efficiently find jobs that are "due" for retry.
*   **`api/routes.ts`**: Fastify routes that expose metrics and allow "Retrying" dead jobs.

---

## 🧱 8. Architecture Decision Records (ADRs)

### ADR-001: Why Redis LIST not SORTED SET for the main queue
**Decision**: We use native Redis `LIST` structures (`queue:*:waiting:<priority>`) combined with `BRPOP` across multiple lists for priority routing, rather than a single `SORTED SET` (ZSET) scored by priority.
**Alternatives considered**:
*   A single Redis Sorted Set (`ZSET`) where the score represents priority (e.g., high=1, normal=2, low=3).
*   Using a combination of Redis Streams (`XADD` / `XREADGROUP`).
**Why we chose this**: Using a distinct `LIST` for each priority level allows us to leverage the `BRPOP` command's native left-to-right key evaluation (implemented in `src/worker/WorkerPool.ts` inside `workerLoop()`). When passing `[queue:high, queue:normal, queue:low]` to `BRPOP`, the Redis C-engine guarantees strict O(1) priority ordering with zero application-side sorting overhead and zero CPU spin-looping.
**Trade-offs**: We gave up the ability to easily paginate or inspect the entire combined queue of waiting jobs chronologically, and adding dynamic priority levels involves modifying the block query list sequentially instead of just assigning a new arbitrary floating-point score.

### ADR-002: Why BRPOP blocking dequeue not polling with setInterval
**Decision**: Workers retrieve jobs using the blocking connection primitive `BRPOP` with a timeout of 0 (infinite block), rather than continuously polling the queue with `LPOP` or `ZRANGE` inside a `setInterval` loop.
**Alternatives considered**:
*   Polling `LPOP` every 100ms inside a JavaScript timer loop.
*   Implementing long-polling via Redis Pub/Sub channels.
**Why we chose this**: `BRPOP` drastically reduces network I/O and Redis CPU utilization by moving the wait state to the socket layer (manifesting in `src/worker/WorkerPool.ts`). Instead of bombarding the Redis server with tight-loop read commands when the queue is empty, the connection simply sleeps and Redis pushes the job immediately to the waiting socket the millisecond an `LPUSH` occurs in `src/queue/Queue.ts`, achieving sub-millisecond dispatch latency.
**Trade-offs**: We gave up connection multiplexing. Because a blocked socket cannot execute other commands, each concurrent worker loop requires its own dedicated TCP connection, scaling Redis connections linearly with worker concurrency.

### ADR-003: Why Lua scripts for job state transitions not MULTI/EXEC
**Decision**: We handle idempotent queue insertions using an atomic Lua script (`src/lib/redis/scripts/idempotentEnqueue.lua`) rather than a transactional `MULTI`/`EXEC` block with `WATCH` in our TypeScript API.
**Alternatives considered**:
*   Using `WATCH idempotency:key`, yielding to `GET` phase, followed by a `MULTI` -> `SET` + `LPUSH` -> `EXEC` block.
*   Checking existence via `GET` in generic Node.js logic and tolerating occasional duplicate enqueues.
**Why we chose this**: A `MULTI/EXEC` transaction block tracking `WATCH` keys requires multiple network round-trips and is subject to optimistic concurrency failures requiring complex application-level retries. A Lua script executes as a single, uninterrupted blocking operation directly on the Redis engine, entirely eliminating Time-Of-Check to Time-Of-Use (TOCTOU) race conditions for concurrent producers executing `Queue.enqueue()` simultaneously with identical idempotency criteria.
**Trade-offs**: We gave up slight performance scaling logic on the clustered Redis server level, as Lua scripts securely block the entire Redis single-threaded event loop while executing, necessitating that we keep the script specifically focused on fast O(1) operations (`SET NX` and `LPUSH`).

### ADR-004: Why heartbeat TTL not job-level TTL for stall detection
**Decision**: We detect crashed workers using a decoupled `heartbeat:<jobId>` key with a short TTL that the worker continuously renews in the background, rather than placing an expiration TTL directly on the job hash.
**Alternatives considered**:
*   Setting an absolute visibility timeout directly on the job payload in Redis upon dequeue.
*   Relying purely on application-level TCP keepalives and socket drops.
**Why we chose this**: A job-level TTL intrinsically conflates "slow execution" with "worker failure" (as structurally documented in `src/worker/Watchdog.ts`). By spawning an asynchronous `setInterval` to periodically refresh the string TTL during `WorkerPool.processJob()`, the `Watchdog` checking `MGET` comprehensively distinguishes true worker process crashes (where the event loop halts) from legitimately slow I/O-bound tasks that simply require extended time to resolve.
**Trade-offs**: We gave up minimal Redis key sparsity. Tracking active execution securely requires managing two distinct footprints per active job (the `active_jobs:<queue>` hash tracker and the `heartbeat:<id>` string), subtly increasing memory footprint and maintaining background `SET/EX` traffic constraints.

### ADR-005: Why separate Redis connections per worker not a shared connection
**Decision**: We instantiate a dedicated `ioredis` TCP connection via `createBlockingClient()` for every concurrent worker process initialized by the `WorkerPool`, explicitly bypassing the primary shared application Redis client.
**Alternatives considered**:
*   Multiplexing all database commands onto a single global connection pool for the entire application interface.
*   Routing blocking commands through generic unmanaged HTTP proxies.
**Why we chose this**: The internal `workerLoop()` leverages `BRPOP` (in `src/worker/WorkerPool.ts`) to block the listener socket until work surfaces. Because `ioredis` transmits pipeline commands sequentially per socket context, invoking a blocking read on a shared connection queues all subsequent web/API commands (like `enqueue` or endpoint metrics) behind the locked socket indefinitely. Reserving unique isolated connections guarantees the core singleton remains totally unblocked targeting peak-throughput parallel operations context.
**Trade-offs**: We gave up baseline connection frugality limit checks. Scaling a single Node.js instance to `concurrency=100` abruptly allocates 101 separate TCP Redis sockets, which can precipitously cross database `maxclients` deployment limits in heavily scaled multi-pod orchestration without an intermediary layer like Twemproxy.

---

## 🛠️ 9. Installation Guide

### Prerequisites
*   **Node.js** (v18+)
*   **Redis Server** (v6.2+)

### Setup
```bash
# 1. Clone & Install
git clone https://github.com/Garrur/Distri_sys.git
cd Distri_sys
npm install

# 2. Configure (Optional)
# Edit src/config/index.ts or set ENV variables

# 3. Start the System
npm run dev
```

---

## 🔌 9. How to Integrate in Other Projects

We provide a **standalone SDK** (`distri-sdk`) for easy integration.

**1. Install**
```bash
npm install distri-task-sdk ioredis
```

**2. Enqueue in your app**
```typescript
import { Queue } from 'distri-task-sdk';
import Redis from 'ioredis';

const redis = new Redis();
const myQueue = new Queue(redis, 'main_queue');

await myQueue.enqueue('send_welcome_email', { email: 'user@example.com' });
```

---

## 🧪 10. Testing

We use **Integration Tests** targeting a real Redis instance (or TestContainers).
*   **Tests cover:** Priority ordering, concurrency safety, and recovery from worker "crashes" (simulated by manual heartbeat deletion).

---

## 📊 11. Monitoring & Metrics

The system exposes a `/stats` endpoint:
*   **Queues**: Lengths of all priority, delayed, and dead lists.
*   **Metrics**: Total processed, global failure rate, and **Average Latency (ms)**.

These power the **Premium Morphism Dashboard** included in the `frontend/` folder.

---

## ⚠️ 12. Failure Handling

*   **Worker Crash**: Watchdog detects missing heartbeat → Requeues job → Atomic state reset.
*   **Redis Down**: Workers will exponentially backoff their connection attempts until Redis is back.
*   **Job Loop**: Exponential backoff prevents "hitting" a failing third-party API too fast.

---

## 🧠 13. Interview Questions + Answers

**Q: Why use Redis for a queue instead of a database like Postgres?**
*   *A: Redis is in-memory and supports atomic blocking operations (`BRPOP`). It is significantly faster for high-throughput locking/unlocking of tasks.*

**Q: How do you handle "The Thundering Herd" problem?**
*   *A: Our Workers use jittered exponential backoff. They don't all retry at the exact same millisecond, preventing a sudden spike on the system.*

**Q: If you have 100 workers, do you need 100 Redis connections?**
*   *A: For blocking pops, yes. Each `BRPOP` takes over the TCP connection. We manage this via a dedicated Connection Pool.*

---

## ⚖️ 14. Trade-offs & Limitations

*   **At-Least-Once Delivery**: Because we requeue stalled jobs, it is possible for a job to run twice (if a worker crashes *after* finishing but *before* removing the heartbeat). **Tasks must be idempotent.**
*   **Memory Bound**: Redis stores everything in RAM. You cannot store millions of huge file-blobs in the queue; you should store the file *path* instead.

---

## 🚀 15. Future Improvements

*   **Clustering**: Support for Redis Cluster to handle millions of jobs per second across multiple Redis nodes.
*   **Rate Limiting**: Add a bucket algorithm to ensure we don't send too many emails per hour to a specific provider.

---

## 📌 16. Summary

This project is a high-performance **Distributed Engine**. It separates "What to do" from "How to do it," ensuring your application remains fast, scalable, and resilient to crashes.
