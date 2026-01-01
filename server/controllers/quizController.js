const quizService = require("../services/quizService");
const mongoose = require("mongoose");
const { getChannel } = require("../config/rabbitmq");
const Quiz = require("../models/quizModel");

/**
 * Generate final quiz for a course
 * POST /api/courses/:courseId/quiz/generate
 */
const generateQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.auth.payload.sub;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId" });
    }

    // Ensure quiz document exists (do NOT overwrite questions)
    const quiz = await Quiz.findOneAndUpdate(
      { courseId },
      {
        $setOnInsert: {
          courseId,
          createdBy: userId,
          questions: [],
        },
      },
      { upsert: true, new: true }
    );

    // If already generated, do NOT enqueue again
    if (quiz.questions.length > 0) {
      return res.status(200).json({
        status: "READY",
        message: "Quiz already generated",
      });
    }

    // Enqueue job
    const channel = getChannel();
    channel.sendToQueue(
      "quiz_generation",
      Buffer.from(
        JSON.stringify({
          quizId: quiz._id,
          courseId,
          userId,
        })
      ),
      { persistent: true }
    );

    return res.status(202).json({
      status: "GENERATING",
      message: "Quiz generation started",
    });
  } catch (error) {
    console.error("Generate quiz error:", error);
    return res.status(500).json({
      message: "Failed to enqueue quiz generation",
    });
  }
};

/**
 * Get quiz for a course
 * GET /api/courses/:courseId/quiz
 */
const getQuizByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId" });
    }

    const quiz = await Quiz.findOne({ courseId });

    // Quiz not created
    if (!quiz) {
      return res.status(200).json({
        status: "NOT_CREATED",
      });
    }

    // Quiz exists but still generating
    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(200).json({
        status: "GENERATING",
      });
    }

    // Quiz ready
    return res.status(200).json({
      status: "READY",
      questions: quiz.questions.map(q => ({
        question: q.question,
        options: q.options,
      })),
    });
  } catch (error) {
    console.error("Get quiz error:", error);
    return res.status(500).json({
      message: "Failed to fetch quiz",
    });
  }
};

/**
 * Submit quiz answers and get score
 * POST /api/courses/:courseId/quiz/submit
 */
const submitQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { answers } = req.body;
    const userId = req.auth.payload.sub;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        message: "Answers must be an array",
      });
    }

    const result = await quizService.submitQuiz({
      courseId,
      answers,
      userId,
    });

    return res.json(result);
  } catch (error) {
    console.error("Submit quiz error:", error);

    return res.status(400).json({
      message: error.message || "Failed to submit quiz",
    });
  }
};

const reviewQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.auth?.payload?.sub || "dev-user";

    const quizWithAnswers = await quizService.getQuizWithAnswers({
      courseId,
      userId,
    });

    return res.json(quizWithAnswers);
  } catch (error) {
    console.error("Review quiz error:", error);

    return res.status(400).json({
      message: error.message || "Failed to review quiz",
    });
  }
};
module.exports = {
  generateQuiz,
  getQuizByCourse,
  submitQuiz,  
  reviewQuiz,
};  