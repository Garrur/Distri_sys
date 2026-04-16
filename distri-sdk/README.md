# distri-task-sdk

Minimal producer SDK for the Distributed Task Queue system.

## Installation

```bash
npm install distri-task-sdk ioredis uuid
```

## Usage

```typescript
import { Redis } from 'ioredis';
import { Queue } from 'distri-task-sdk';

const redis = new Redis('redis://localhost:6379');
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

## License
MIT
