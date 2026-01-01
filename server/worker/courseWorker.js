require("dotenv").config();
const amqp = require("amqplib");
const mongoose = require("mongoose");

const connectDB = require("../connectDB");
const Course = require("../models/courseModel");
const Module = require("../models/moduleModel");
const Lesson = require("../models/lessonModel");
const aiService = require("../services/ai");

mongoose.set("bufferCommands", false); // 🔒 prevent silent buffering bugs

(async () => {
  try {
    // 1️⃣ CONNECT TO MONGODB (CRITICAL)
    await connectDB();
    console.log(" Worker MongoDB connected");

    // 2️⃣ CONNECT TO RABBITMQ
    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue("course_generation", { durable: true });

    console.log(" Worker listening on queue: course_generation");

    // 3️⃣ CONSUME JOBS
    channel.consume("course_generation", async (msg) => {
      if (!msg) return;

      const { courseId, topic, userId } = JSON.parse(
        msg.content.toString()
      );

      console.log(" Job received:", { courseId, topic });

      try {
        await Course.findByIdAndUpdate(courseId, {
          status: "GENERATING_MODULES",
        });

        console.log(" Generating course outline…");
        const aiResult = await aiService.generateCourseOutline(topic);

        for (let i = 0; i < aiResult.modules.length; i++) {
          const moduleData = aiResult.modules[i];

          const module = await Module.create({
            title: moduleData.title,
            courseId,
            order: i + 1,
          });

          for (let j = 0; j < moduleData.lessons.length; j++) {
            await Lesson.create({
              title: moduleData.lessons[j],
              courseId,
              moduleId: module._id,
              orderNo: j + 1,
              content: [],
            });
          }
        }

        await Course.findByIdAndUpdate(courseId, {
          status: "READY",
        });

        console.log(` Course ${courseId} generation completed`);
        channel.ack(msg);
      } catch (err) {
        console.error(" Worker failed:", err);

        await Course.findByIdAndUpdate(courseId, {
          status: "FAILED",
          error: err.message,
        });

        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error(" Worker startup failed:", err);
    process.exit(1);
  }
})();
