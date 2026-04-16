# Distri-SDK: Queue Producer

A lean, portable SDK to enqueue tasks into the Distributed Task Queue system from any Node.js project.

## Installation

Ensure you have the required dependencies in your host project:

```bash
npm install ioredis uuid
```

## Usage

Simply drop the `distri-sdk` folder into your project and initialize it with an `ioredis` client.

```typescript
import { Redis } from 'ioredis';
import { Queue } from './distri-sdk';

const redis = new Redis({ host: 'localhost', port: 6379 });
const queue = new Queue(redis, 'main_queue');

async function triggerTask() {
  const job = await queue.enqueue('process_video', { 
    id: 'vid_123', 
    format: 'mp4' 
  }, { priority: 'high' });

  console.log(`Task enqueued: ${job.id}`);
}

triggerTask();
```

## Features
- **Strict Priority**: Enqueue into `high`, `normal`, or `low` partitions.
- **Payload Safety**: Fully typed data payloads using TypeScript generics.
- **Portability**: No reliance on global configuration or specific loggers.
```
