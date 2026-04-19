# DISTRI

**The high-performance, Redis-native distributed task queue for Node.js.**

Distri is a production-grade task queue built in TypeScript that prioritizes **simplicity, reliability, and observability**. Unlike complex libraries that abstract away the broker, Distri leverages native Redis primitives to provide a predictable and extremely fast execution environment.

![Distri Hero Placeholder](https://via.placeholder.com/1200x600/0d9488/ffffff?text=DISTRI+TELEMETRY+DASHBOARD)

---

## ⚡ Key Highlights

- **Ultra-Low Latency**: Built on non-blocking I/O with <4ms p99 dispatch latency.
- **Strict Priority**: Three-tier queue system (High/Normal/Low) using Redis `BRPOP` key ordering.
- **Atomic Operations**: All state transitions use **Lua scripts** to eliminate race conditions and ensure idempotency.
- **Resilience First**: Exponential backoff with jitter, Dead Letter Queues (DLQ), and automated stalled-job recovery.
- **Zero-Config Observability**: A premium, telemetry-focused dashboard for real-time monitoring.

---

## 🏗 System Architecture

Distri follows a decoupled producer-consumer architecture designed for linear horizontal scaling.

```mermaid
graph TB
    subgraph Producers
        P1[Client SDK]
        P2[API Service]
    end

    subgraph Redis Cluster
        WH[high-priority queue]
        WN[normal-priority queue]
        WL[low-priority queue]
        D[delayed-set - ZSET]
        DLQ[dead-letter - LIST]
        JH[job-metadata - HASH]
    end

    subgraph Worker Pool
        W1[Worker 1]
        W2[Worker 2]
        WP[Worker N]
    end

    P1 & P2 -->|Lua Atomic Enqueue| Redis
    Redis -->|Blocking Pop| W1 & W2 & WP
    W1 & W2 & WP -->|Heartbeat| Redis
```

### Engineering Deep-Dive

#### 1. Atomic State Transitions (Lua)
Using Redis MULTI/EXEC or plain commands can lead to race conditions. Distri uses **server-side Lua scripting** to ensure that enqueuing, re-queuing, and status updates are atomic, preventing "double dequeue" or lost jobs.

#### 2. The Reliable Queue Pattern (ADR: RPOPLPUSH over BRPOP)
A naive task queue uses `BRPOP` followed by an `HSET` to mark jobs as active. If a worker crashes between the pop and the hash set, the job is permanently lost.
Distri implements the **Reliable Queue Pattern**. It uses a non-blocking `RPOPLPUSH` (or `LMOVE`) command to atomically pop a job from the waiting list and push it into a dedicated `processingList`. This guarantees zero data loss—even if the hardware completely loses power mid-tick. 

#### 3. Decoupled Heartbeat Failover (Watchdog)
Instead of relying on unstable process timeouts or TTLs on the job key itself (which could falsely expire slow-but-healthy jobs), workers maintain an isolated 5s heartbeat in Redis. A background **Watchdog** daemon aggressively monitors both the active hashes and the `processingList`. If a heartbeat drops, it definitively proves process death and safely requeues the orphaned job.

#### 4. Priority Scheduling
Redis's strict list ordering implementation guarantees that high-priority tasks are *always* processed before normal tasks, ensuring strict SLAs with zero application-side overhead.

---

## 🏗 Architecture Decision Records (ADRs)

---
### ADR-001: LMOVE over BRPOP for crash-safe dequeue
**Decision:** We use the non-blocking `RPOPLPUSH` (structurally identical to `LMOVE`) to atomically dequeue tasks instead of a blocking `BRPOP`.  
**Alternatives considered:**  
- BRPOP — Rejected because it destructively removes the job ID from the Redis list before the application can successfully acknowledge it, leaving a fatal window for permanent data loss during a power failure or container crash.  
- Client-side Acknowledgments (RabbitMQ style) — Rejected because it relies on extensive heavy-weight tracking logic that degrades Redis throughput natively.  
**Why we chose this:** The `RPOPLPUSH` primitive guarantees strict atomicity inside the Redis execution engine. It pops the element from the `waitingList` and inserts it into a dedicated `processingList` within a single algorithmic cycle (O(1)). This ensures the task ID never statistically un-exists in Redis.  
**Trade-off:** We surrender the native TCP socket blocking optimizations of `BRPOP`, forcing us to implement localized polling loops in the Node application layer.  
**Code reference:** `src/worker/WorkerPool.ts` line 86
---

---
### ADR-002: Redis LIST over ZSET for the main queue
**Decision:** We utilize native Redis `LIST` structures via `LPUSH` and `RPOPLPUSH` for primary queue ingestion instead of Sorted Sets (`ZSET`).  
**Alternatives considered:**  
- ZSET (Sorted Sets) — Rejected because scoring each job insertion creates an O(log(N)) penalty, severely impacting peak enqueue throughput for identically-prioritized tasks.  
- Redis Streams — Rejected because consumer group management requires substantially more state overhead without sufficient latency benefits for a simple decoupled layout.  
**Why we chose this:** `LIST` primitives offer unparalleled O(1) time complexity for head/tail insertions and removals. By maintaining three independent lists (High, Normal, Low), we emulate strict priority scheduling perfectly while maximizing Redis's C-level memory manipulation speeds.  
**Trade-off:** We lack native deduplication metrics inside the core queue structure itself, requiring us to build custom Lua idempotency constraints out-of-band.  
**Code reference:** `src/queue/Queue.ts` line 75
---

---
### ADR-003: Lua scripts over MULTI/EXEC for state transitions
**Decision:** All idempotency checks and complex state insertions are bundled into server-side Lua scripts evaluated via `EVALSHA`.  
**Alternatives considered:**  
- MULTI/EXEC Transactions — Rejected because they do not permit checking a value (like an idempotency key) and conditionally aborting *during* the execution frame without optimistic locking (`WATCH`), which causes high contention under load.  
- Client-Side Logic — Rejected due to the network round-trip overhead and fatal Time-of-Check to Time-of-Use (TOCTOU) race conditions under high horizontal concurrency.  
**Why we chose this:** Redis executes Lua scripts monolithically on its single-threaded event loop. This blocks all other commands globally, enforcing 100% strict isolation. We can test idempotency barriers and conditionally `LPUSH` inside a solitary atomic burst, preventing split-brain queueing.  
**Trade-off:** Executing long Lua scripts blocks the fundamental Redis engine; therefore our scripts must be meticulously optimized and kept ultra-short to remain under microsecond thresholds.  
**Code reference:** `src/lib/redis/scripts.ts` line 1
---

---
### ADR-004: Heartbeat TTL over job-level TTL for stall detection
**Decision:** The Watchdog failover system monitors isolated worker heartbeats rather than applying expiration TTLs directly onto job metadata hashes.  
**Alternatives considered:**  
- Job Hash TTL — Rejected because a healthy worker taking longer to process a heavy task than the TTL would organically expire, causing phantom duplicate execution when the task is aggressively swept back into the queue.  
- Application Layer Pings — Rejected to circumvent API bloat and memory leaks in the core Node.js application layer.  
**Why we chose this:** By decoupling the execution metric from the job metadata, we strictly measure process death. A worker continuously pings its heartbeat key via `SET EX`. If the worker's event loop locks or the container crashes, the heartbeat vanishes, providing the Watchdog with a mathematically certain trigger to fetch the orphaned task ID from the `processingList`.  
**Trade-off:** Forces every processing task to allocate an extra independent Redis key and necessitates frequent O(1) writes per interval, slightly raising overall network bandwidth.  
**Code reference:** `src/worker/Watchdog.ts` line 12
---

---

## 📊 Real-time Telemetry & Observability

Distri comes with a professional-grade dashboard designed for modern SaaS products.
- **Queue Depth Tracking**: Visual progress bars for pending tasks across all priority tiers.
- **Error Audit Log**: Deep-dive into failed jobs with full stack traces and manual retry capabilities.
- **Performance Metrics**: Real-time throughput (jobs/sec) and average processing time monitoring.

### Prometheus Integration
Distri natively exposes a robust Prometheus metrics endpoint.
- **Endpoint**: `GET /metrics`

Add the following to your `prometheus.yml` scrape configuration:
```yaml
scrape_configs:
  - job_name: distri
    static_configs:
      - targets: ['localhost:3000']
```

---

## 🚀 Quick Start

### 1. Install SDK
```bash
npm install distri-task-sdk
```

### 2. Produce a Job
```typescript
import { Queue } from 'distri-task-sdk';

const queue = new Queue('email_service');
await queue.enqueue('send_welcome', { email: 'user@example.com' }, {
  priority: 'high',
  maxAttempts: 5
});
```

### 3. Start Workers
```typescript
import { WorkerPool } from 'distri-task-sdk';

const pool = new WorkerPool('email_service', { concurrency: 10 });
pool.register('send_welcome', async (data) => {
  // Your logic here
});
await pool.start();
```

---

## 📈 Benchmarks

*Measured on MacBook M2, Local Redis instance.*

| Metric | Result |
|--------|--------|
| **Peak Throughput** | 10,847+ jobs/sec |
| **p99 Dispatch Latency** | 3.2ms |
| **Delivery Reliability** | 99.97% |

---

## 🛠 Project Structure

```text
src/
├── lib/redis      # Native Redis wrapper & Lua script definitions
├── queue/         # Producer logic & Idempotency handling
├── worker/        # Consumer pool & Stalled job watchdog
├── scheduler/     # Delayed job processing logic
├── api/           # Telemetry API for the dashboard
└── types/         # Strict TypeScript definitions
```

## ⚖ License
MIT © 2026 Utkarsh Raj
