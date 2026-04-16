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

## 🛠️ 8. Installation Guide

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
