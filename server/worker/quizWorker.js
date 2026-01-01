require("dotenv").config();
const amqp = require("amqplib");
const connectDB = require("../connectDB");
const Quiz = require("../models/quizModel");
const Course = require("../models/courseModel");
const aiService = require("../services/ai");

(async () => {
  await connectDB();
  console.log("Quiz Worker MongoDB connected");

  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue("quiz_generation", { durable: true });

  console.log("Listening on queue: quiz_generation");

  channel.consume("quiz_generation", async (msg) => {
    if (!msg) return;

    const payload = JSON.parse(msg.content.toString());
    const { quizId, courseId } = payload;
    console.log("Quiz job received:", quizId);
    if (!quizId) {
      console.error("quizId missing in queue payload");
      channel.nack(msg, false, false);
      return;
    }

    try {
      const quiz = await Quiz.findById(quizId);
      if (!quiz) {
        throw new Error("Quiz not found");
      }

      if (quiz.status === "READY") {
        channel.ack(msg);
        return;
      }

      const course = await Course.findById(courseId);
      if (!course) {
        throw new Error("Course not found");
      }

      const quizContext = {
        courseTitle: course.title,
        courseDescription: course.description || "",
      };

      const aiQuiz = await aiService.generateQuizAI(quizContext, "v2");

      const questions = (aiQuiz.questions || []).map((q) => ({
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
      }));

      if (!questions.length) {
        throw new Error("AI returned empty quiz");
      }

      quiz.questions = questions;
      quiz.status = "READY";
      await quiz.save();

      console.log("Quiz generated:", quizId);
      channel.ack(msg);
    } catch (err) {
      console.error("Quiz worker failed:", err.message);

      await Quiz.findByIdAndUpdate(quizId, {
        status: "FAILED",
        error: err.message,
      });

      channel.nack(msg, false, false);
    }
  });
})();
