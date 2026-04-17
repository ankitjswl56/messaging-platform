# SecureSync: High-Throughput Messaging Engine

SecureSync is a high-performance, real-time messaging platform engineered to handle both instant text communication and heavy binary payloads without blocking the main event loop. It features a WhatsApp-style rich media interface, direct-to-S3 file uploads, and optimistic UI rendering for a zero-latency user experience.

## 🏗 System Architecture

The application is built using a decoupled microservices architecture to ensure high-bandwidth file transfers do not interfere with the low-latency WebSocket signaling required for real-time chat.

1. **Frontend Client:** Next.js 15 + React 19 + Tailwind CSS 4.1. Implements optimistic UI rendering using local Blobs, click-to-load media placeholders for bandwidth conservation, and native XHR for byte-level upload progress tracking.
2. **API Backend:** Node.js + Express + Socket.io. Acts as the signaling orchestrator. Generates offline AWS SigV4 pre-signed URLs for secure object storage access and maintains an In-Memory LRU Cache for instant chat history retrieval.
3. **Object Storage:** MinIO (S3-compatible). Acts as the primary blob storage. The frontend pushes and pulls heavy binaries directly to/from MinIO, entirely bypassing the Node.js API to prevent event-loop saturation.
4. **Message Broker (Background Worker):** RabbitMQ. Manages background tasks (like heavy archive `.zip` generation) via an isolated Node.js worker utilizing High-Efficiency `stream` pipelines, maintaining a near-zero disk footprint.

## 🚀 Tech Stack

* **Frontend:** React (Next.js 15, React 19 Compiler), TypeScript, Tailwind 4.1, Socket.io-client
* **Backend:** Node.js, Express, Socket.io, AWS SDK v3
* **Messaging:** RabbitMQ (AMQP)
* **Storage:** MinIO (Object Storage)
* **Infrastructure:** Docker, Docker Compose, Anonymous Volumes

## 🛠 Prerequisites

To run this project locally, you must have the following installed:

* [Docker](https://docs.docker.com/get-docker/)
* [Docker Compose](https://docs.docker.com/compose/install/)
* *Note: Local Node.js installations are not required, as everything is containerized and isolated using anonymous volumes to prevent host-system binary conflicts.*

## 💻 Local Development Setup

The entire stack is orchestrated via Docker Compose, ensuring environment parity and zero-configuration setups for new engineers.

### 1. Clone the repository

```bash
git clone https://github.com/ankitjswl56/messaging-platform.git
cd messaging-platform
```

### 2. Boot the Stack

Run the following command to build the TypeScript files, download the base images, isolate local dependencies, and start the network:

```bash
docker-compose up --build -V -d
```

### 3. Access the Services

Once the containers are healthy, the microservices will be exposed on the following ports:

* **Frontend App:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** `http://localhost:3001`
* **MinIO Console (Storage UI):** [http://localhost:9001](http://localhost:9001) *(Default: `minioadmin` / `minioadmin`)*
* **RabbitMQ Management:** [http://localhost:15672](http://localhost:15672) *(Default: `guest` / `guest`)*

## 📂 Project Structure

```text
.
├── backend-api/
│   ├── Dockerfile           # API container with pnpm store isolation
│   ├── src/server.ts        # WebSocket signaling & LRU Cache implementation
│   ├── src/services/        # AWS SDK v3 offline Presigned URL generation
│   └── package.json
├── worker-service/
│   ├── Dockerfile           # Background task consumer container
│   ├── src/worker.ts        # RabbitMQ consumer & Stream piping logic
│   └── package.json
├── frontend/
│   ├── Dockerfile           # Next.js dev server container
│   ├── app/page.tsx         # Real-time UI & XHR upload tracking
│   └── package.json
└── docker-compose.yml       # Infrastructure orchestration
```

## 🧠 Design Decisions & Trade-offs

* **Why Direct-to-S3 Uploads?** Routing multi-gigabyte file uploads through a Node.js Express server consumes massive amounts of RAM and blocks concurrent socket connections. By generating offline SigV4 Pre-signed URLs on the backend, the frontend uploads directly to MinIO, keeping the chat server blazingly fast.
* **Why XHR over Fetch API?** The modern `fetch` API lacks native support for tracking upload byte progression. We implemented classic `XMLHttpRequest` logic wrapped in Promises to provide users with a smooth, WhatsApp-style real-time upload progress ring.
* **Optimistic UI vs. Bandwidth Conservation:** Senders immediately see a rendered preview of their media using a local memory Blob. Receivers, however, receive a lightweight SVG placeholder. The actual multi-megabyte media file is only downloaded when the receiver clicks to reveal it, drastically saving data limits on mobile networks.
* **In-Memory LRU Cache vs. Database:** For this prototype, maintaining message history is handled via an In-Memory LRU (Least Recently Used) cache directly on the Node container. It successfully provides instant history hydration on page reloads without the heavy infrastructure overhead of an active PostgreSQL instance.

## 🧹 Teardown

To stop all services and remove the containers, networks, and volumes (this will wipe your local MinIO object storage):

```bash
docker-compose down -v
```

---

### About

SecureSync is a high-throughput messaging and file transfer platform (prototype).

[www.jaiswalankit.com.np](https://www.jaiswalankit.com.np)