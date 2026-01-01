require("dotenv").config();
const amqp = require("amqplib");
const mongoose = require("mongoose");

const connectDB = require("../connectDB");
const Lesson = require("../models/lessonModel");
const Module = require("../models/moduleModel");
const Course = require("../models/courseModel");
const aiService = require("../services/ai");

mongoose.set("bufferCommands", false);

(async () => {
  try {
    await connectDB();
    console.log("Lesson Worker MongoDB connected");

    const conn = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue("lesson_generation", { durable: true });

    console.log("Listening on queue: lesson_generation");

    channel.consume("lesson_generation", async (msg) => {
        if (!msg) return;

        const { lessonId } = JSON.parse(msg.content.toString());
        console.log("Lesson job received:", lessonId);

        try {
            const lesson = await Lesson.findById(lessonId).lean();

            if (!lesson) {
            console.log("Lesson not found, acking:", lessonId);
            channel.ack(msg);
            return;
            }

            // Idempotency guard
            if (lesson.status === "READY") {
            console.log("Lesson already READY, skipping:", lessonId);
            channel.ack(msg);
            return;
            }

            const module = await Module.findById(lesson.moduleId).lean();
            const course = await Course.findById(lesson.courseId).lean();

            if (!module || !course) {
            throw new Error("Course or Module missing");
            }

            const aiResult = await aiService.generateLessonContent({
            courseTitle: course.title,
            moduleTitle: module.title,
            lessonTitle: lesson.title,
            });

            await Lesson.findByIdAndUpdate(
            lessonId,
            {
                content: aiResult.content,
                quiz: aiResult.quiz,
                status: "READY",
            },
            { new: false }
            );

            console.log("Lesson generated:", lessonId);
            channel.ack(msg);
        } catch (err) {
            console.error("Lesson worker failed:", err.message);

            await Lesson.findByIdAndUpdate(lessonId, {
            status: "FAILED",
            error: err.message,
            }).catch(() => {});

            channel.ack(msg);
        }
        });

  } catch (err) {
    console.error("Lesson worker startup failed:", err);
    process.exit(1);
  }
})();
