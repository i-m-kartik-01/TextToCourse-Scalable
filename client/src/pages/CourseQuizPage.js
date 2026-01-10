import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function CourseQuizPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [quiz, setQuiz] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const pollTimerRef = useRef(null);

  /* ---------------- FETCH QUIZ ---------------- */
  const fetchQuiz = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/courses/${courseId}/quiz`
      );

      if (!res.ok) throw new Error("FETCH_FAILED");

      const data = await res.json();

      if (data.status === "NOT_CREATED") {
        setStatus("NOT_CREATED");
        return;
      }

      if (data.status === "GENERATING") {
        setStatus("GENERATING");
        return;
      }

      if (data.status === "READY" && Array.isArray(data.questions)) {
        setQuiz(data);
        setAnswers(new Array(data.questions.length).fill(null));
        setStatus("READY");

        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    } catch {
      setError("Unable to reach server");
    }
  }, [courseId]);

  /* ---------------- INITIAL LOAD ---------------- */
  useEffect(() => {
    fetchQuiz();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [fetchQuiz]);

  /* ---------------- GENERATE QUIZ ---------------- */
  const generateQuiz = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        },
      });

      setStatus("GENERATING");

      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/courses/${courseId}/quiz/generate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to enqueue quiz generation");

      pollTimerRef.current = setInterval(fetchQuiz, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  /* ---------------- SUBMIT QUIZ ---------------- */
  const submitQuiz = async () => {
    if (!isAuthenticated) {
      setError("Please login to submit the quiz.");
      return;
    }

    try {
      setSubmitting(true);

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        },
      });

      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/courses/${courseId}/quiz/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ answers }),
        }
      );

      if (!res.ok) throw new Error("Submission failed");

      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- UI ---------------- */

  if (status === "LOADING") {
    return <div className="min-h-screen flex items-center justify-center">Loading quiz…</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  }

  if (status === "NOT_CREATED") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={generateQuiz} className="bg-blue-700 text-white px-6 py-3 rounded-xl">
          Generate Quiz
        </button>
      </div>
    );
  }

  if (status === "GENERATING") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>
          <h1 className="text-xl font-bold mb-2">Generating Quiz</h1>
          <p>Please wait…</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>
          <h1 className="text-2xl font-bold mb-4">Quiz Completed</h1>
          <p>{result.correctAnswers} / {result.totalQuestions}</p>
          <button
            onClick={() => navigate(`/courses/${courseId}/quiz/review`)}
            className="mt-4 bg-blue-700 text-white px-6 py-3 rounded-xl"
          >
            Review Answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {quiz.questions.map((q, idx) => (
        <div key={idx} className="mb-6 bg-white p-6 rounded-xl">
          <p className="font-medium mb-2">{idx + 1}. {q.question}</p>
          {q.options.map((opt, i) => (
            <label key={i} className="block">
              <input
                type="radio"
                checked={answers[idx] === i}
                onChange={() => {
                  const next = [...answers];
                  next[idx] = i;
                  setAnswers(next);
                }}
              />
              <span className="ml-2">{opt}</span>
            </label>
          ))}
        </div>
      ))}

      <button
        onClick={submitQuiz}
        disabled={submitting || answers.some(a => a === null)}
        className="bg-green-600 text-white px-6 py-3 rounded-xl"
      >
        Submit Quiz
      </button>
    </div>
  );
}
