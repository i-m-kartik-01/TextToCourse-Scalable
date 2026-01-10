import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function LessonPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const generationTriggeredRef = useRef(false);
  const pollTimerRef = useRef(null);

  /* ---------------- DARK MODE ---------------- */
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  /* ---------------- FETCH LESSON ---------------- */
  const fetchLesson = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/lessons/${lessonId}`
      );

      if (!res.ok) {
        throw new Error("Lesson not found");
      }

      const data = await res.json();
      setLesson(data);

      if (Array.isArray(data.content) && data.content.length > 0) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setGenerating(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  /* ---------------- INITIAL LOAD ---------------- */
  useEffect(() => {
    fetchLesson();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [fetchLesson]);

  /* ---------------- GENERATE IF EMPTY ---------------- */
  useEffect(() => {
    if (!lesson) return;
    if (!isAuthenticated) return;
    if (Array.isArray(lesson.content) && lesson.content.length > 0) return;
    if (generationTriggeredRef.current) return;

    generationTriggeredRef.current = true;

    const generateLesson = async () => {
      try {
        setGenerating(true);

        const token = await getAccessTokenSilently();

        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}/api/lessons/${lessonId}/generate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error("Lesson generation failed");
        }

        pollTimerRef.current = setInterval(fetchLesson, 2000);
      } catch (err) {
        setError(err.message);
        setGenerating(false);
      }
    };

    generateLesson();
  }, [lesson, isAuthenticated, getAccessTokenSilently, fetchLesson, lessonId]);

  /* ---------------- STATES ---------------- */
  if (loading) return <p className="p-10">Loading lesson...</p>;
  if (generating) return <p className="p-10">Generating lesson...</p>;
  if (error) return <p className="p-10 text-red-600">{error}</p>;
  if (!lesson) return <p className="p-10">Lesson not found</p>;

  /* ---------------- RENDER CONTENT ---------------- */
  const renderBlock = (block, i) => {
    switch (block.type) {
      case "heading":
        return (
          <h2
            key={i}
            className="text-2xl font-semibold mt-10 mb-4 text-slate-900 dark:text-white"
          >
            {block.value}
          </h2>
        );
      case "paragraph":
        return (
          <p
            key={i}
            className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300"
          >
            {block.value}
          </p>
        );
      case "code":
        return (
          <pre
            key={i}
            className="bg-slate-900 text-white p-4 rounded-lg mb-6 overflow-x-auto"
          >
            <code>{block.value}</code>
          </pre>
        );
      default:
        return null;
    }
  };

  const handleSubmit = () => setSubmitted(true);

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-700 flex items-center justify-between px-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-slate-600 dark:text-slate-300 hover:underline"
        >
          Back
        </button>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="text-sm px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-8 text-slate-900 dark:text-white">
          {lesson.title}
        </h1>

        {Array.isArray(lesson.content) &&
          lesson.content.map(renderBlock)}

        {Array.isArray(lesson.quiz) && lesson.quiz.length > 0 && (
          <div className="mt-16 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
              Quiz
            </h2>

            {lesson.quiz.map((q, i) => (
              <div key={i} className="mb-8">
                <p className="font-medium mb-3 text-slate-900 dark:text-slate-200">
                  {q.question}
                </p>

                {q.options.map((opt) => {
                  const isCorrect = submitted && opt === q.answer;
                  const isWrong =
                    submitted && selected[i] === opt && opt !== q.answer;

                  return (
                    <label
                      key={opt}
                      className={`block p-3 rounded-lg border mb-2 cursor-pointer
                        text-slate-900 dark:text-slate-200
                        ${
                          isCorrect
                            ? "bg-green-100 border-green-500"
                            : isWrong
                            ? "bg-red-100 border-red-500"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                      <input
                        type="radio"
                        disabled={submitted}
                        onChange={() =>
                          setSelected({ ...selected, [i]: opt })
                        }
                        className="mr-2"
                      />
                      {opt}
                    </label>
                  );
                })}

                {submitted && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}

            {!submitted && (
              <button
                onClick={handleSubmit}
                className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2 rounded-lg"
              >
                Submit Quiz
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
