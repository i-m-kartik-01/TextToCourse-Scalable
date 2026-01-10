TextToCourse – Distributed AI Course Generation Platform

TextToCourse is a distributed backend system that converts user prompts into fully structured courses using asynchronous job processing, worker pools, and fault-tolerant message queues.
The platform is designed to be scalable, resilient, and production-ready. Instead of handling expensive AI generation inside HTTP requests, it offloads work to background workers through RabbitMQ, allowing the API to remain fast and reliable under load.
The API publishes jobs to RabbitMQ. Workers consume these jobs and perform AI-based course generation asynchronously. Results are written to MongoDB and served to users when ready.
This architecture enables horizontal scaling, fault isolation, and non-blocking API performance.



Key Features

Asynchronous job processing using RabbitMQ
Independent worker services for course, lesson, and quiz generation
Stateless API layer for horizontal scalability
Redis for caching and coordination
MongoDB as the primary data store
Eventual consistency for background processing
GitHub Actions CI/CD pipeline
Automatic deployment to AWS EC2
Process supervision and restarts using PM2

Technology Stack

Node.js
Express
RabbitMQ
Redis
MongoDB
PM2
AWS EC2
GitHub Actions
Auth0

How the System Works

A user submits a request from the frontend.
The API validates the request and publishes a job to RabbitMQ.
Worker services pick up the job from the queue.
Workers generate course content using AI.
Results are stored in MongoDB.
The API serves the generated content to the user.
Redis is used to cache frequently accessed data and coordinate worker state.
This design ensures the API is never blocked by heavy processing and that work can be scaled independently.

Fault Tolerance

The system is designed around failure-aware principles:
Jobs are persisted in RabbitMQ until successfully processed
Workers can crash and restart without losing jobs
Eventual consistency ensures the system continues functioning during transient failures


The backend is deployed on AWS EC2 Linux Machine and managed using PM2.

A GitHub Actions CI/CD pipeline is configured to automatically deploy the backend on every push to the main branch:
GitHub Actions runs a basic CI step
Code is pulled into EC2 over SSH
Dependencies are installed
PM2 restarts the API and worker processes
This provides continuous delivery with no manual server access required.


Running Locally
Prerequisites

Node.js
RabbitMQ
Redis
MongoDB

Install dependencies
cd server
npm install

Start API
node index.js

Start workers
node worker/courseWorker.js
node worker/lessonWorker.js
node worker/quizWorker.js


Future Improvements

The system is designed to support advanced reliability features such as:

Job retries
Dead-letter queues
Circuit breakers
Observability (Prometheus, Grafana)
Zero-downtime deployments
Worker autoscaling

These can be added incrementally as load increases.

This allows the platform to recover automatically from many types of infrastructure and network issues.
