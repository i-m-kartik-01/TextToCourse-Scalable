const amqp = require("amqplib");

let connection;
let channel;

const QUEUES = [
  "course_generation",
  "lesson_generation",
  "quiz_generation",
];

async function connectRabbitMQ() {
  if (channel) return channel; // prevent multiple connections

  try {
    const rabbitUrl =
      process.env.RABBITMQ_URL || "amqp://127.0.0.1:5672";

    // 1️⃣ Create connection
    connection = await amqp.connect(rabbitUrl);

    // 2️⃣ Create channel
    channel = await connection.createChannel();

    // 3️⃣ Assert queues (durable = survives restart)
    for (const queue of QUEUES) {
      await channel.assertQueue(queue, { durable: true });
    }

    console.log("RabbitMQ connected");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Closing RabbitMQ connection...");
      await channel.close();
      await connection.close();
      process.exit(0);
    });

    return channel;
  } catch (error) {
    console.error("RabbitMQ connection failed:", error);
    throw error;
  }
}

function getChannel() {
  if (!channel) {
    throw new Error(
      "RabbitMQ channel not initialized. Call connectRabbitMQ() first."
    );
  }
  return channel;
}

module.exports = {
  connectRabbitMQ,
  getChannel,
};
