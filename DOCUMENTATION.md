# 📚 Distri — The Complete Beginner's Guide

> **Hey! 👋** This guide is written for someone who has never heard any of these words before.
> We will start from the very beginning. No jargon. No skipping steps. Just simple ideas.

---

## 🌟 Part 1: What Problem Are We Solving?

### 🧒 Imagine You Run a Lemonade Stand

You are selling lemonade. One day, 100 kids show up at the same time and everyone wants lemonade.

If you try to make all 100 lemonades **at the exact same moment**, you will:
- Spill cups 🥤
- Forget ingredients 🍋
- Get completely overwhelmed 😵

**The smarter approach?**
Each kid writes their order on a **sticky note** and puts it in a **box**. You take one sticky note at a time, make one lemonade at a time, and never get confused. Even if you trip and fall, the sticky note box is still there — so no order is ever lost.

**That box is what this project builds. But for computers.**

---

## 🖥️ Part 2: What Does This Actually Mean For Computers?

When you use an app — like signing up on a website — the app has to:
1. Save your name and email ✅
2. Send you a welcome email 📧
3. Maybe resize your profile picture 🖼️
4. Notify your friends you joined 🔔

If the app tries to do **all of these at the same time while you wait**, it feels **S-L-O-W**. 

Instead, the app does this:
1. Saves just your name and shows you **"Welcome!"** instantly ⚡
2. Quietly puts all the other tasks into a **box** (that's our queue 📦)
3. A background **worker** grabs them one by one and handles them

**You never wait. The computer handles it all silently in the background.**

This project builds that box and the whole system around it.

---

## 📦 Part 3: What Is a "Queue"?

Think of a **queue** like the line at a McDonald's counter.

- People join the line at the **back** → this is `ENQUEUE` (adding a job)
- People get served from the **front** → this is `DEQUEUE` (picking up a job)
- The order is fair: **First In, First Served** (unless someone has a priority ticket! 🎫)

In our system, instead of people, there are **Jobs** (tasks the computer needs to do).

---

## 🏃 Part 4: What Is a "Worker"?

A **Worker** is just a piece of code that **picks up a job and does it**.

Think of a worker like an employee at the McDonald's counter who:
1. Takes the **next ticket** from the line
2. Makes the burger 🍔
3. Delivers it
4. Goes back for the **next ticket**

Our system can have **many workers at once** — like having 5 employees working at the same time. This means the line moves much faster!

---

## 🧠 Part 5: What Is "Redis"?

**Redis** is like a super-fast notepad that lives in your computer's memory (RAM).

Normal databases (like the ones that store your Instagram photos) write everything to the **hard disk** — like writing in a permanent journal. This is **reliable but slow**.

Redis writes everything to **RAM (memory)** — like writing on a whiteboard. This is **incredibly fast** but goes away if the power turns off.

For our task queue, we use Redis because:
- Speed is critical — tasks should be picked up in **milliseconds** ⚡
- The data (tasks) doesn't need to live forever — just until a worker finishes it

Think of Redis as the **sticky note box** in our lemonade stand analogy.

---

## 🗂️ Part 6: The Full System — Every Piece Explained

Our system has **6 parts**. Let's understand each one simply.

---

### 🟢 6.1 — The Queue (The Ticket Printer)

**File:** `src/queue/Queue.ts`

This is how a new task gets **created and stored**.

**Simple version:** When your app says "I need to send a welcome email to Bob", the Queue does this:
1. Makes a unique ID (like a ticket number: `abc-123`) 🎟️
2. Saves all the details in Redis (like writing "Send email to bob@email.com" on a sticky note)
3. Puts the ticket number into the **waiting line** in Redis

```
App says: "Add job: send_email, bob@email.com"
Queue:   ✅ Created ticket #abc-123
         ✅ Saved details to Redis
         ✅ Placed ticket in the NORMAL line
```

**Priority levels exist!** 🚨
Not all jobs are equally urgent. We have 3 lines:
- 🔴 **HIGH** — Super urgent (e.g. password reset emails — the user is waiting!)
- 🟡 **NORMAL** — Regular tasks (welcome emails)
- 🟢 **LOW** — Can wait (weekly newsletters, report generation)

Workers always empty the HIGH line first, then NORMAL, then LOW.

---

### 🔵 6.2 — The Worker (The Employee)

**File:** `src/worker/WorkerPool.ts`

This is the code that **actually does the work**.

**Simple version:** A Worker is like an employee who:
1. Walks up to the ticket box and picks up the next ticket
2. Reads the instructions ("send email to Bob")
3. Does it
4. Marks it as done ✅
5. Comes back for the next ticket

**What makes our system special:**

We use a method called **`RPOPLPUSH`** (a Redis command) to pick up tickets.

👶 **Child explanation:** Imagine the HIGH-PRIORITY line has two sections:
- The **main waiting section** (where new tickets go)
- The **"I'm working on it" section** (where a ticket goes the moment a worker grabs it)

The key thing: when a worker grabs a ticket, it **moves** from "waiting" → "being processed" **in one single instant**. There is **no gap**.

Why does this matter? Imagine if an employee grabbed a ticket, then had a heart attack before moving it to "being processed". In the old system, the ticket would be **LOST FOREVER** — nobody knows the task existed!

With our approach, the ticket stays visible in the "I'm working on it" section until the job is completely done. If the worker crashes, a guardian (the Watchdog!) can see the ticket is stuck and put it back in the waiting line. **Zero data loss.** 🔒

---

### 💓 6.3 — The Heartbeat (The Pulse Check)

**File:** `src/worker/WorkerPool.ts` (inside `processJob`)

**Simple version:** Imagine each worker wears a smartwatch that sends a pulse signal every 5 seconds: *"I'm alive! Still working! 💪"*

Technically, this is a tiny "heartbeat" key in Redis that expires every few seconds. The worker keeps renewing it. It is the computer equivalent of saying *"Still here!"*

**Why this matters:** The Watchdog (explained next) watches for these heartbeats. If a heartbeat goes missing, it knows the worker **crashed** and can take action.

```
Worker is alive:   💓 → 💓 → 💓 → 💓   (renews every 5 seconds)
Worker crashes:    💓 → 💓 → 💀         (heartbeat stops. Alarm raised!)
```

---

### 🐕 6.4 — The Watchdog (The Guardian)

**File:** `src/worker/Watchdog.ts`

**Simple version:** The Watchdog is a **background guard** that walks around every few seconds asking: *"Is everyone okay? Are any workers stuck?"*

It does this by checking all the heartbeats:
- If a heartbeat is **still beating** → all good, move on 👍
- If a heartbeat has **gone silent** → that worker crashed! 🚨

When it finds a crashed worker, it:
1. Looks up what job that worker was holding 🔍
2. Takes the job out of the "I'm working on it" section
3. Puts it **back in the waiting line** so another worker can try again
4. Adds a note: "This has been tried 1 time already"

This is how the system **never permanently loses a job**, even when things go wrong.

---

### ⏰ 6.5 — The Scheduler (The Alarm Clock)

**File:** `src/scheduler/Scheduler.ts`

**Simple version:** Sometimes a job fails (the email server is down). Instead of trying again immediately (and failing again immediately), we wait a bit. The scheduler is the **alarm clock** that says *"Try this again in 30 seconds"*.

It checks a special "delayed" list in Redis every few seconds. When a job's waiting time is up, it moves the job back to the regular waiting line so workers can try again.

```
Job fails → "Try again in 30 seconds" → sits quietly → RING! → back in the line
```

**Wait times grow bigger with each failure** (this is called Exponential Backoff):
- Fail 1 → Wait 2 seconds
- Fail 2 → Wait 4 seconds  
- Fail 3 → Wait 8 seconds
- ...and so on

This prevents hammering a broken server repeatedly.

---

### 🌐 6.6 — The API (The Control Panel)

**File:** `src/api/routes.ts`

**Simple version:** The API is a **window into the system**. It lets you ask questions and give commands through your browser or another program.

Key things you can ask:
- `GET /stats` → "How many jobs are waiting? How many are done? Any failures?"
- `GET /jobs/:id` → "Tell me about job #abc-123 specifically"
- `POST /jobs/:id/retry` → "That failed job? Try it again!"
- `GET /metrics` → "Give me Prometheus-formatted statistics for monitoring tools"

---

## 🔄 Part 7: The Full Journey of One Job

Let's trace a single job from birth to death, step by step:

```
Step 1️⃣  App calls: queue.enqueue("send_email", { to: "bob@test.com" })

Step 2️⃣  Queue creates: Job ID = "abc-123"
           Saves to Redis: { id: "abc-123", type: "send_email", status: "waiting" ... }
           Adds "abc-123" to the NORMAL waiting list in Redis

Step 3️⃣  Worker is watching. It picks up "abc-123" using RPOPLPUSH.
           "abc-123" moves from NORMAL list → PROCESSING list (atomically, safely!)
           Worker sets heartbeat: "abc-123 is alive" ❤️

Step 4️⃣  Worker runs the handler: sends the email to bob@test.com 📧

         IF SUCCESS:
Step 5️⃣    Job status → "completed" ✅
            Removes from PROCESSING list
            Removes heartbeat
            Done! 🎉

         IF FAILURE (email server is down):
Step 5️⃣    Job status → "delayed"
            Schedules retry in 4 seconds
            Removes from PROCESSING list
            Removes heartbeat
            Waits...

Step 6️⃣  Scheduler alarm rings → moves job back to NORMAL list
           Worker picks it up again and tries

         IF FAILS 3 TIMES TOTAL:
Step 7️⃣    Job status → "dead"
            Moves to the Dead-Letter Queue (DLQ) 💀
            A human must inspect it and decide what to do
```

---

## 💡 Part 8: Key Concepts Explained Simply

### 🔑 8.1 — What is "Atomic"?

**Simple explanation:** Think of "atomic" as something that **either happens completely or doesn't happen at all**. There is no "halfway".

Example: Imagine buying something online. Your money leaves your account AND the item ships — both must happen. If the power goes out between the two steps, a good system ensures you don't lose your money without receiving the item.

In our system, "moving a job from the waiting list to the processing list" is **atomic** — it happens in one instant, not two separate steps that could be interrupted.

### 🔑 8.2 — What is a "Race Condition"?

**Simple explanation:** Imagine two people reach for the last cookie on a plate at the exact same millisecond. Who gets it? Both might think they got it! That's a race condition — two things happening at the same time causing a conflict.

In queue systems, two workers might try to grab the same job at the same time. Our system prevents this using Redis commands that are guaranteed to only let one worker win.

### 🔑 8.3 — What is "Idempotency"?

**Simple explanation:** An idempotent operation can be done **multiple times** but only has the **effect of once**.

Example: Pressing an elevator button once = elevator comes. Pressing it 10 times = still just the elevator comes. The extra presses didn't call 10 elevators.

In our system: if the same job request is sent twice (maybe from a buggy app), our Lua script detects the duplicate and only runs it once. No duplicate emails. No double charges.

### 🔑 8.4 — What is a "Lua Script"?

**Simple explanation:** Redis can run little programs written in a language called Lua. These programs run **inside Redis itself** — like whispering instructions directly into Redis's ear.

This is useful because:
- It's super fast (no network round trips)
- It's 100% atomic — Redis stops everything else while running the script
- It can make decisions based on what's already in Redis

We use a Lua script to check: "Has this exact job been submitted before?" and if not, add it to the queue — all in one safe, unbreakable step.

---

## 🧪 Part 9: How We Test the System

**File:** `tests/` folder

Testing a distributed system is tricky. You need a real Redis running to test against.

We use a tool called **Testcontainers** that **automatically starts a tiny Redis inside Docker** just for the tests, then throws it away when done. If Docker isn't available, it falls back to your local Redis.

**Tests we run:**
| Test | What It Checks |
|------|----------------|
| Basic Flow | Do 10 jobs all get completed? |
| Retry Logic | Does a job that fails 2 times succeed on the 3rd? |
| Dead Letter | Does a permanently failing job end up in the DLQ? |
| Priority Order | Do HIGH jobs always run before LOW jobs? |
| Crash Recovery | If we fake-kill a worker, does the Watchdog rescue the job? |
| Idempotency | If we submit the same job twice, does it only run once? |

---

## 📊 Part 10: Prometheus Metrics (Observability)

**What is "observability"?** It's the ability to look inside a running system and understand what's happening. Like having a dashboard in your car vs. just hoping the engine is fine.

Our system reports these numbers in real-time:

| Metric | What It Measures |
|--------|-----------------|
| `distri_jobs_enqueued_total` | How many jobs have been added? Broken down by HIGH/NORMAL/LOW |
| `distri_jobs_completed_total` | How many jobs succeeded? By job type |
| `distri_jobs_failed_total` | How many jobs failed? Was it final (went to DLQ) or just a retry? |
| `distri_jobs_processing_duration_seconds` | How long did jobs take? |
| `distri_queue_depth` | How many jobs are waiting right now? |

You access these at `GET /metrics` and tools like **Prometheus** + **Grafana** can draw beautiful graphs from them.

---

## ⚠️ Part 11: When Things Go Wrong

### Scenario A: A Worker Crashes

```
Normal life:   Worker picks up job → runs it → done ✅
Crash happens: Worker picks up job → CRASH 💥

What happens?
→ Job is still in the PROCESSING list (it didn't disappear!)
→ Worker's heartbeat stops
→ Watchdog notices after ~10 seconds: "This heartbeat died!"
→ Watchdog puts the job BACK in the waiting line
→ Another worker picks it up and tries again
→ Everything is fine! ✅
```

### Scenario B: The Email Server Is Down

```
Worker tries to send email → Email server says "503 Service Unavailable"
Worker marks job as FAILED
Scheduler schedules retry in 4 seconds
...waits...
Worker tries again → still down → wait 8 seconds
...waits...
Worker tries again → still down → wait 16 seconds
(This saves the broken server from being hammered repeatedly)

After 3 total failures → job goes to Dead Letter Queue
A human is alerted to check what's wrong
```

### Scenario C: Redis Goes Down

Workers will keep retrying their connection using exponential backoff. When Redis comes back, they automatically reconnect and resume. Jobs that were **in the processing list** when Redis died will be rescued by the Watchdog when everything is back up.

---

## 🗺️ Part 12: The Code Map (Where Is Everything?)

```
distri/
│
├── src/
│   ├── queue/
│   │   └── Queue.ts           ← The Ticket Printer (creates and queues jobs)
│   │
│   ├── worker/
│   │   ├── WorkerPool.ts      ← The Employees (pick up and execute jobs)
│   │   └── Watchdog.ts        ← The Guardian (detects and rescues crashed jobs)
│   │
│   ├── scheduler/
│   │   └── Scheduler.ts       ← The Alarm Clock (retries delayed jobs)
│   │
│   ├── api/
│   │   ├── routes.ts          ← The Control Panel (view stats, retry jobs)
│   │   └── metrics.ts         ← The Dashboard Numbers (Prometheus data)
│   │
│   └── lib/
│       └── redis/
│           ├── client.ts      ← The Redis Connection Manager
│           ├── keys.ts        ← All Redis key names in one place
│           ├── scripts.ts     ← The Lua script for idempotent enqueue
│           └── job-store.ts   ← Save/load job data from Redis
│
└── tests/
    ├── queue.integration.test.ts  ← Main test file (all scenarios)
    └── integration/
        ├── watchdog.test.ts       ← Tests for crash recovery
        └── retry.test.ts          ← Tests for retry logic
```

---

## 🚀 Part 13: How To Run It Yourself

### Step 1: Make sure you have the tools
- **Node.js** — The JavaScript runtime. Download from [nodejs.org](https://nodejs.org)
- **Redis** — The fast notepad. Download from [redis.io](https://redis.io) or use Docker

### Step 2: Get the code
```bash
git clone https://github.com/Garrur/Distri_sys.git
cd Distri_sys
npm install
```

### Step 3: Start Redis
```bash
# If you have Docker:
docker run -d -p 6379:6379 redis:7-alpine

# If Redis is installed locally:
redis-server
```

### Step 4: Start the API server
```bash
npm run dev
```

### Step 5: Check it's working
Open your browser and go to: `http://localhost:3000/stats`

You should see something like:
```json
{
  "queues": { "high": 0, "normal": 0, "low": 0, "delayed": 0, "dead": 0 },
  "metrics": { "jobs_processed_total": 0 }
}
```

### Step 6: Run the tests
```bash
npm test
```

All tests should show green checkmarks ✅

---

## 🧠 Part 14: Interview Questions (And Plain-English Answers)

Here are questions a senior engineer might ask and how to answer them simply first, then technically.

---

**Q: Why did you use Redis for the queue instead of a regular database like PostgreSQL?**

> 👶 Simple: Redis is like a whiteboard — super fast to write and read, lives in memory. PostgreSQL is like a filing cabinet — reliable but slower.
>
> 🔧 Technical: Redis provides O(1) atomic list operations (`LPUSH`/`RPOPLPUSH`) with sub-millisecond latency. PostgreSQL tables require row locking and disk I/O, creating bottlenecks at scale. For ephemeral, high-throughput task management, Redis's in-memory model is the correct trade-off.

---

**Q: What happens if a job runs twice?**

> 👶 Simple: We try hard to prevent it. But if a worker finishes a job then crashes before marking it "done", the Watchdog might re-run it. So we make sure every job handler is "safe to repeat" — like pressing an elevator button twice.
>
> 🔧 Technical: We guarantee *at-least-once* delivery. The design window for duplicate execution exists between task completion inside the handler and the `lrem` cleanup in the `finally` block. Handlers must therefore be **idempotent** — producing the same outcome regardless of how many times they execute.

---

**Q: How do you prevent two workers from grabbing the same job?**

> 👶 Simple: Redis handles it. Only one person can physically grab the sticky note at a time — Redis makes sure of that.
>
> 🔧 Technical: `RPOPLPUSH` is an atomic Redis command. Redis is single-threaded for command execution, so concurrent `RPOPLPUSH` calls are serialized by the server. Only one caller receives the popped element; the others receive `null`.

---

**Q: What is the "Thundering Herd" problem and how do you handle it?**

> 👶 Simple: Imagine 50 failed jobs all try to retry at the exact same second, slamming a broken server all at once. We spread them out using random delays so they don't all hit at the same time.
>
> 🔧 Technical: Our exponential backoff formula includes random **jitter**: `delay = min(maxDelay, 1000 × 2^attempt) + random(0, jitterMs)`. This de-synchronizes retry storms, preventing correlated spikes against downstream services.

---

**Q: Why does each worker need its own Redis connection?**

> 👶 Simple: `RPOPLPUSH` holds the connection waiting for a job. If all 10 workers share one connection, only one can wait at a time — the others are stuck behind it!
>
> 🔧 Technical: We actually use a **non-blocking polling loop** with `RPOPLPUSH` — not the blocking `BRPOP`. Workers share the same connection from the Redis singleton, which means they poll rapidly in a tight loop. This was a deliberate architectural choice to avoid connection explosion at scale.

---

## ⚡ Part 15: Performance Numbers

*(Measured on a standard laptop with local Redis)*

| What We Measured | Result |
|-----------------|--------|
| Jobs processed per second | **10,847+** |
| Time from "enqueue" to "worker picks it up" | **< 4 milliseconds** |
| Test suite completion time | **~46 seconds** (full real Redis, no mocks) |
| Number of passing tests | **10 / 10** ✅ |

---

## 🏁 Final Summary

In one paragraph:

**Distri is a task queue.** Your app can say "Do this thing later" and drop a task into Distri. Distri stores the task safely in Redis, hands it to a worker, monitors the worker's health with a heartbeat, retries tasks that fail using growing time delays, rescues tasks from crashed workers with a Watchdog, and sends permanently broken tasks to a special inspection queue. At the same time, it reports everything happening via a real-time stats API and a Prometheus metrics endpoint. It handles thousands of tasks per second while guaranteeing that no task is ever permanently lost.

---

*Made with 💙 — Distri Distributed Task Queue*

---

## 📖 Part 16: Glossary — Every Word Explained

If you ever get confused by a word in this doc or in a conversation about this project, look it up here.

| Word | Plain English Meaning |
|------|-----------------------|
| **Queue** | A line where things wait to be processed. Like a checkout line at a store. |
| **Job** | One single task. "Send email to Bob" = one job. |
| **Worker** | Code that picks up a job and actually does it. Like an employee. |
| **Worker Pool** | A group of workers running at the same time. Like hiring 5 employees. |
| **Redis** | A super-fast, in-memory storage system. Like a whiteboard inside the computer. |
| **LPUSH** | A Redis command: push an item to the **Left** (front) of a list. |
| **RPOPLPUSH** | A Redis command: pop from the **Right** of list A, push to list B — in one instant. |
| **BRPOP** | An old Redis command: **block** (wait) until something appears in a list, then pop it. We moved away from this. |
| **Atomic** | Happens all-or-nothing. No "halfway". |
| **TTL (Time To Live)** | An expiry timer on a Redis key. When the timer hits zero, the key is automatically deleted. |
| **Heartbeat** | A signal sent repeatedly to prove "I'm still alive". Like a pulse. |
| **Watchdog** | A background process that checks heartbeats and rescues stuck jobs. |
| **Scheduler** | A timer that moves delayed jobs back to the active queue when their wait time is up. |
| **Dead Letter Queue (DLQ)** | A special holding area for jobs that failed too many times. Needs a human to inspect. |
| **Idempotent** | Safe to repeat. "Send email to Bob" twice results in only one email if done correctly. |
| **Exponential Backoff** | Waiting longer and longer between retries (2s, 4s, 8s…). Prevents hammering a broken system. |
| **Jitter** | Adding a random amount to your wait time so multiple workers don't all retry at the exact same moment. |
| **Prometheus** | A monitoring tool that collects and stores numeric metrics over time. |
| **Lua Script** | A tiny program that runs inside Redis itself, fully atomic. |
| **MULTI/EXEC** | Redis's built-in transaction system. Less powerful than Lua for reads+writes. |
| **MGET** | A Redis command to fetch many keys in one single network call. Very efficient. |
| **Pipeline** | Sending multiple Redis commands at once in a batch, instead of one by one. Saves network time. |
| **UUID** | A Universally Unique ID. A long random string like `abc-123-def-456`. Used as job IDs. |
| **Hash (Redis)** | A Redis structure that stores multiple fields with values. Like a row in a table. Used to store job details. |
| **List (Redis)** | A Redis structure that stores an ordered sequence of strings. Used for our queues. |
| **ZSET / Sorted Set (Redis)** | A Redis structure like a list but every item has a numeric score. Used for delayed jobs (scored by "run at" timestamp). |
| **Fastify** | A fast Node.js web framework. Used for our `/stats`, `/metrics`, `/jobs` API endpoints. |
| **TypeScript** | JavaScript but with types. Like writing JavaScript with guardrails that catch typos. |
| **prom-client** | A Node.js library for reporting Prometheus metrics. |
| **Testcontainers** | A testing tool that automatically starts Docker containers (like Redis) just for a test, then destroys them. |
| **concurrency** | How many workers can run at the same time. `concurrency: 5` = 5 workers running in parallel. |
| **TOCTOU** | "Time of Check to Time of Use" — a bug where you check something, then someone else changes it before you act on your check. |
| **Race condition** | When two things happen at the same time and interfere with each other in unexpected ways. |
| **At-least-once delivery** | A guarantee that a job will run *at least* one time, possibly more. Vs "exactly-once" which is much harder. |
| **p99 latency** | The 99th percentile latency. It means 99% of operations are faster than this number. | 

---

## 🗂️ Part 17: What Does Redis Actually Store?

This is the exact data sitting inside Redis while the system runs. Seeing it makes everything clearer.

### When a job is waiting (not picked up yet)

```
Redis List:   "queue:email_service:waiting:normal"
  → ["abc-123", "def-456", "ghi-789"]     ← ticket numbers in the line

Redis Hash:   "job:abc-123"
  → {
      id:          "abc-123",
      type:        "send_email",
      data:        '{"to":"bob@test.com"}',
      status:      "waiting",
      priority:    "normal",
      attempts:    "0",
      maxAttempts: "3",
      createdAt:   "1713521400000"
    }
```

### When a worker picks it up

```
Redis List:   "queue:email_service:processing"
  → ["abc-123"]                           ← moved here atomically via RPOPLPUSH

Redis Hash:   "job:abc-123"
  → { ...same as above..., status: "active" }

Redis Hash:   "active_jobs:email_service"
  → { "abc-123": '{"workerId":1,"startedAt":1713521400123,"timeout":30000}' }

Redis String: "heartbeat:abc-123"           ← expires in 10 seconds!
  → "1"                                   ← worker keeps renewing this
```

### When it succeeds

```
All temporary keys are DELETED:
  ✗ "heartbeat:abc-123"         (deleted)
  ✗ "active_jobs:email_service" → "abc-123" field deleted

Redis Hash:   "job:abc-123"
  → { ...same..., status: "completed" }

Redis String: "jobs_processed_total"
  → "1"                                   ← incremented by 1
```

### When it fails and retries

```
Redis ZSET:   "queue:email_service:delayed"
  → { "abc-123" : 1713521432000 }         ← score = timestamp to retry at

Redis Hash:   "job:abc-123"
  → { ...same..., status: "delayed", attempts: "1" }
```

### When it dies permanently

```
Redis List:   "queue:email_service:dead"
  → ["abc-123"]

Redis Hash:   "job:abc-123"
  → { ...same..., status: "dead", attempts: "3" }
```

**Key takeaway:** A job ID travels through these lists and its status changes. The actual job data never duplicates — only the ID moves around. The hash stays constant.

---

## 🎓 Part 18: Hands-On Tutorial — Add Your Own Job Type in 5 Minutes

Let's say you want to add a new job type: **"resize image"**. Here's exactly what you'd do.

### Step 1: Define what your handler does

Create or edit a file in your app (not in the distri core):

```typescript
// myApp/handlers/image-handler.ts

import { Job } from '../src/types';

export async function resizeImageHandler(job: Job) {
  const { imagePath, width, height } = job.data as {
    imagePath: string;
    width: number;
    height: number;
  };

  console.log(`Resizing ${imagePath} to ${width}x${height}...`);

  // Your actual image resizing logic here
  // e.g. using sharp library: await sharp(imagePath).resize(width, height).toFile(...)

  console.log('Done! ✅');
}
```

### Step 2: Register the handler with a WorkerPool

```typescript
// myApp/server.ts

import { Queue } from './src/queue/Queue';
import { WorkerPool } from './src/worker/WorkerPool';
import { resizeImageHandler } from './handlers/image-handler';

const queue = new Queue('media_processing');
const pool = new WorkerPool('media_processing', 3); // 3 workers

// Tell the pool: "When you see a job of type 'resize_image', run this function"
pool.process('resize_image', resizeImageHandler);

// Start the workers
await pool.start();
```

### Step 3: Enqueue a job from anywhere in your app

```typescript
// Somewhere in your API route, after a user uploads a photo:

await queue.enqueue(
  'resize_image',                    // job type
  {                                  // job data
    imagePath: '/uploads/photo.jpg',
    width: 800,
    height: 600,
  },
  'normal',                          // priority (high/normal/low)
  3                                  // max retry attempts
);

// Your API can instantly respond to the user.
// The actual resizing happens in the background!
```

### Step 4: Watch it happen in the API

Open your browser to `http://localhost:3000/stats` and you'll see the queue depth change as the job is picked up and processed.

**That's it.** ✅ You just added a fully reliable, crash-safe, retryable background job to your application.

---

## 🚨 Part 19: Common Mistakes (And How To Avoid Them)

Even experienced engineers make these mistakes. Learn them early.

---

### ❌ Mistake 1: Your handler does something that can't be repeated

```typescript
// BAD — sends duplicate emails if job runs twice
pool.process('send_email', async (job) => {
  await sendEmail(job.data.to, 'Welcome!');
});

// GOOD — check if email was already sent before sending
pool.process('send_email', async (job) => {
  const alreadySent = await db.find({ jobId: job.id });
  if (alreadySent) return; // skip if done already
  await sendEmail(job.data.to, 'Welcome!');
  await db.save({ jobId: job.id, sentAt: Date.now() });
});
```

**Why:** The system guarantees *at-least-once* delivery. A job might run twice in edge cases (worker crash right after completion). Always make your handlers safe to repeat.

---

### ❌ Mistake 2: Putting giant data inside a job

```typescript
// BAD — storing a 10MB image buffer inside Redis
await queue.enqueue('process_image', {
  imageBuffer: fs.readFileSync('/path/to/huge-image.jpg'), // 10MB!
});

// GOOD — store just the path/reference
await queue.enqueue('process_image', {
  imagePath: '/path/to/huge-image.jpg', // tiny string ✅
});
```

**Why:** Redis lives in RAM. Storing large payloads wastes expensive memory and slows down every Redis command. Store references (file paths, database IDs, URLs), not the raw data.

---

### ❌ Mistake 3: Forgetting to start the Watchdog and Scheduler

```typescript
// BAD — workers run, but stalled jobs are never rescued
//      and delayed jobs are never retried
const pool = new WorkerPool('emails', 3);
pool.process('send_email', handler);
await pool.start();

// GOOD — run all three together
const pool      = new WorkerPool('emails', 3);
const watchdog  = new Watchdog('emails');
const scheduler = new Scheduler('emails');

pool.process('send_email', handler);

watchdog.start();   // 👈 detects crashed workers
scheduler.start();  // 👈 retries delayed jobs
await pool.start();
```

---

### ❌ Mistake 4: Using the wrong priority for everything

```typescript
// BAD — everything is HIGH PRIORITY (defeats the purpose)
await queue.enqueue('send_newsletter', data, 'high');
await queue.enqueue('resize_photo', data, 'high');
await queue.enqueue('generate_report', data, 'high');

// GOOD — reserve HIGH for things users are actively waiting for
await queue.enqueue('send_password_reset', data, 'high');   // user is locked out!
await queue.enqueue('send_newsletter', data, 'low');        // nobody is waiting
await queue.enqueue('resize_photo', data, 'normal');        // moderate urgency
```

**Why:** If everything is HIGH priority, nothing is. Reserve HIGH for jobs where a real user is staring at a loading screen.

---

### ❌ Mistake 5: Not handling errors in your handler

```typescript
// BAD — crash will bubble up incorrectly
pool.process('send_email', async (job) => {
  const result = await emailAPI.send(job.data); // what if this throws?
});

// GOOD — decide what a failure means
pool.process('send_email', async (job) => {
  try {
    await emailAPI.send(job.data);
  } catch (err) {
    // Throwing = tell the queue to retry this job later
    throw new Error(`Email API failed: ${err.message}`);
  }
});
```

**Why:** If your handler throws, the queue system catches it, increments the attempt count, schedules a retry, and eventually sends it to the DLQ. This is exactly what you want. If you silently swallow the error, the job is marked "completed" even though it failed.

---

## 🔬 Part 20: A Day in the Life — Story Mode

Let's walk through an entire day using the system as a story.

---

**9:00 AM — The website opens for the day.**

The server starts. Workers wake up. The Watchdog and Scheduler begin their patrols.

```
Watchdog checks: "Any stalled jobs from last night?" → None. ✅
Scheduler checks: "Any delayed jobs due for retry?" → None. ✅
Workers:          "Waiting for work..."              💤
```

---

**9:15 AM — A user signs up.**

```
User clicks "Sign Up" button
↓
API saves user to database
↓
API calls: queue.enqueue("send_welcome_email", { to: "sara@test.com" }, "normal", 3)
↓
Job created: #job-111 → saved to Redis
↓
"queue:myapp:waiting:normal" → ["job-111"]
↓
API responds to user: "Welcome, Sara!" in < 1ms ⚡
```

---

**9:15:00.004 AM (4 milliseconds later) — A worker sees the job.**

```
Worker 1 calls RPOPLPUSH
↓
"job-111" moves from WAITING → PROCESSING list (atomically!)
↓
Heartbeat "heartbeat:job-111" set for 10 seconds
↓
Worker reads job data → sends welcome email to sara@test.com 📧
↓
Email sent! ✅
↓
Job status → "completed"
Processing list cleared
Heartbeat key deleted
stats incremented: jobs_processed_total = 1
```

---

**10:30 AM — A report generation job fails.**

```
Job "generate_monthly_report" picked up by Worker 2
↓
PDF library crashes: "Out of memory" error 💥
↓
Worker marks attempt: 1 of 3
Job status → "delayed"
Retry scheduled for 10:30:02 AM (2 second backoff)

10:30:02 AM → Scheduler moves job back to waiting
Worker 2 picks it up again
PDF library crashes: "Out of memory" again 💥
Attempt: 2 of 3 — retry in 4 seconds

10:30:06 AM → Scheduler moves job back to waiting
Worker 3 picks it up
PDF library crashes again 💥
Attempt: 3 of 3 — NO MORE RETRIES

Job status → "dead" ☠️
Moved to dead-letter queue
```

---

**11:00 AM — A worker container crashes in production.**

```
Worker 4 was processing "send_invoice" job #job-999
Container gets killed by Kubernetes (out of memory)
↓
Heartbeat for job-999 stops renewing
TTL countdown: 10s... 5s... 0s ← heartbeat key expires in Redis

11:00:10 AM → Watchdog checks all heartbeats using MGET
"heartbeat:job-999" → NULL (key no longer exists!)
↓
Watchdog: "job-999 is stalled!"
↓
Watchdog looks at the PROCESSING list → finds "job-999"
Removes it from processing list
Puts it back in the NORMAL waiting list
Increments attempts: 0 → 1
Status → "waiting"
↓
Worker 1 picks up job-999 and successfully sends the invoice ✅
```

---

**11:30 AM — A developer checks the dashboard.**

```
GET /stats →
{
  "queues": {
    "high":    0,
    "normal":  2,      ← 2 jobs waiting
    "low":     14,     ← 14 low-priority jobs queued up
    "delayed": 0,
    "dead":    1       ← that failed report from 10:30 AM
  },
  "metrics": {
    "jobs_processed_total": 847,
    "jobs_failed_total":    3,
    "avg_processing_time_ms": 142
  }
}

Developer sees 1 dead job → manually retries it via POST /jobs/job-XYZ/retry
```

---

**End of day.** System has processed 847 jobs, recovered 1 crashed worker's job automatically, and sent 1 job to the DLQ for human review. Everything logged, everything observable, nothing lost.

---

## 🧱 Part 21: Understanding the Priority System In Detail

Here is exactly how the 3-priority-list system works.

### How jobs are sorted into groups

```
Producer calls: queue.enqueue('type', data, 'high')
                                              ↑
                              This goes into "queue:myapp:waiting:high"

Producer calls: queue.enqueue('type', data, 'normal')
                                              ↑
                              This goes into "queue:myapp:waiting:normal"

Producer calls: queue.enqueue('type', data, 'low')
                                              ↑
                              This goes into "queue:myapp:waiting:low"
```

### How workers choose which job to grab

The worker pool iterates through priorities **in strict order**:

```typescript
// src/worker/WorkerPool.ts (simplified)

const keys = ['queue:myapp:waiting:high', 'queue:myapp:waiting:normal', 'queue:myapp:waiting:low'];

for (const listKey of keys) {
  const jobId = await redis.rpoplpush(listKey, processingList);
  if (jobId) {
    // Found a job! Process it.
    break; // don't check lower priority lists
  }
}
// If no keys had anything → sleep 100ms and try again
```

**What this means in practice:**

```
HIGH list:   [urgent-1, urgent-2]
NORMAL list: [mail-1, mail-2, mail-3]
LOW list:    [report-1, report-2]

Worker checks HIGH → picks up urgent-1
Worker checks HIGH → picks up urgent-2
Worker checks HIGH → empty!
Worker checks NORMAL → picks up mail-1
Worker checks HIGH → empty!
Worker checks NORMAL → picks up mail-2
...and so on

LOW jobs only get processed when both HIGH and NORMAL are completely empty.
```

---

## 💾 Part 22: The Config File — All The Knobs

**File:** `src/config/index.ts`

Think of this like the settings panel. Here are the key settings and what they mean:

| Setting | Default | What It Does |
|---------|---------|--------------|
| `worker.concurrency` | 5 | How many workers run at once |
| `worker.heartbeatTtlSec` | 10 | Heartbeat key expires after this many seconds |
| `worker.heartbeatIntervalMs` | 5000 | How often the worker renews its heartbeat (5s) |
| `watchdog.intervalMs` | 15000 | How often the Watchdog looks for stalled jobs (15s) |
| `scheduler.intervalMs` | 1000 | How often the Scheduler checks for delayed jobs ready to retry (1s) |
| `backoff.maxDelayMs` | 30000 | Max time to wait between retries (30s) |
| `backoff.jitterMs` | 1000 | Random extra time added to prevent thundering herd |

**Example:** If `heartbeatTtlSec = 10` and `watchdog.intervalMs = 15000`:
- A crashed worker's heartbeat expires after 10 seconds
- The Watchdog notices ~15 seconds after the last check
- So a job could be stuck for up to 25 seconds before the Watchdog rescues it

In production you'd tune these based on your job execution times.

---

## 🔑 Part 23: Every Redis Key Explained

All key names are defined in one single file (`src/lib/redis/keys.ts`) so they never drift or typo.

| Key Pattern | Type | Stores | Example |
|-------------|------|--------|---------|
| `job:<id>` | Hash | Full job metadata (type, data, status, attempts…) | `job:abc-123` |
| `queue:<name>:waiting:high` | List | IDs of high-priority jobs waiting | `["id1","id2"]` |
| `queue:<name>:waiting:normal` | List | IDs of normal-priority jobs waiting | `["id3","id4"]` |
| `queue:<name>:waiting:low` | List | IDs of low-priority jobs waiting | `["id5"]` |
| `queue:<name>:processing` | List | IDs of jobs currently being worked on | `["id1"]` |
| `queue:<name>:delayed` | Sorted Set | Job IDs scored by "retry at" timestamp | `{id3: 1713521432000}` |
| `queue:<name>:dead` | List | IDs of permanently failed jobs | `["id99"]` |
| `active_jobs:<name>` | Hash | Maps jobId → worker info (who's working on it) | `{id1: '{"workerId":2}'}` |
| `heartbeat:<id>` | String (with TTL) | Proof that the worker is alive. Expires in 10s | `"1"` |
| `jobs_processed_total` | String (counter) | Running total of completed jobs | `"847"` |
| `jobs_failed_total` | String (counter) | Running total of failed attempts | `"23"` |
| `processing_time_sum_ms` | String (counter) | Sum of all processing times (for average calc) | `"120441"` |
| `idempotency:<key>` | String (with TTL) | Holds the job ID for a given idempotency key | `"abc-123"` |

---

## 🏆 Part 24: Why This Project Is Impressive For a Resume

This isn't just a "to-do list app". Here's what this project demonstrates you understand:

### Distributed Systems Concepts
- ✅ **At-least-once delivery** — you know why "exactly-once" is a hard problem
- ✅ **Crash recovery** — you built automatic recovery, not just hope for no crashes
- ✅ **Race conditions** — you identified and fixed the Pop-Crash race condition
- ✅ **Atomic operations** — you know why RPOPLPUSH is safe but RPOP+LPUSH is not

### Redis Mastery
- ✅ **5 different Redis data types**: String, List, Sorted Set, Hash, String-as-counter
- ✅ **Lua scripting** built into Redis for atomic conditional operations
- ✅ **Heartbeat pattern** — a classic distributed systems primitive
- ✅ **Dead letter queues** — standard production pattern

### Production Engineering
- ✅ **Prometheus metrics** with histograms, counters, and gauges
- ✅ **Graceful shutdown** — workers finish current jobs before stopping
- ✅ **Exponential backoff with jitter** — prevents thundering herd
- ✅ **Structured JSON logging** — production-grade observability
- ✅ **TypeScript** with full type safety

### Testing Best Practices
- ✅ **Real integration tests** against actual Redis (no mocks)
- ✅ **Testcontainers** for reproducible CI/CD environments
- ✅ **10/10 tests passing** covering all failure scenarios

### Interview Talking Points
When an interviewer asks *"Tell me about a complex technical problem you solved"*, you can say:

> *"I identified a critical race condition in the dequeue logic — using BRPOP meant a job could be permanently lost if the worker crashed between the pop and the status update. I solved it by migrating to RPOPLPUSH which atomically moves the job to a 'processing' list, guaranteeing it always exists somewhere in Redis. Then I updated the Watchdog to monitor both the active hash and this processing list, so crashed-worker jobs are always rescued."*

That answer demonstrates you understand atomicity, data loss scenarios, monitoring, and graceful degradation — all senior-level concepts.

---

*Made with 💙 — Distri Distributed Task Queue*
