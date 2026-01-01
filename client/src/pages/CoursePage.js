import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const {
    isAuthenticated,
    getAccessTokenSilently,
  } = useAuth0();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openModuleId, setOpenModuleId] = useState(null);

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

  /* ---------------- POLLING CONTROL ---------------- */
  const pollTimerRef = useRef(null);

  /* ---------------- FETCH COURSE ---------------- */
  const fetchCourse = async () => {
    try {
      const headers = {};

      if (isAuthenticated) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: process.env.REACT_APP_AUTH0_AUDIENCE,
          },
        });
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}/api/courses/${courseId}`,
        { headers }
      );

      if (!res.ok) {
        throw new Error("Failed to load course");
      }

      const data = await res.json();
      setCourse(data);

      /*
        FIX: stop polling once modules + lessons exist
        This prevents reload requirement
      */
      const hasModules =
        Array.isArray(data.modules) && data.modules.length > 0;

      const hasLessons =
        hasModules &&
        data.modules.some(
          (m) => Array.isArray(m.lessons) && m.lessons.length > 0
        );

      if (hasModules && hasLessons && pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setLoading(false);
      }
    } catch (err) {
      console.error("Fetch course error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  /* ---------------- INITIAL LOAD ---------------- */
  useEffect(() => {
    fetchCourse();

    /*
      FIX: poll every 2s until backend finishes
      Same pattern as LessonPage
    */
    pollTimerRef.current = setInterval(fetchCourse, 2000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [courseId, isAuthenticated, getAccessTokenSilently]);

  const handleLessonClick = (lessonId) => {
    navigate(`/lessons/${lessonId}`);
  };

  const toggleModule = (moduleId) => {
    setOpenModuleId((prev) =>
      prev === moduleId ? null : moduleId
    );
  };

  /* ---------------- UI STATES ---------------- */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin h-10 w-10 border-t-2 border-blue-800 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-10 text-center text-gray-500">
        Course not found
      </div>
    );
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* TOP BAR */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b flex items-center justify-between px-6">
        <div className="font-semibold text-lg">CourseGen AI</div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="text-sm px-3 py-1 rounded-lg border"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </header>

      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-72 bg-white dark:bg-slate-900 border-r min-h-[calc(100vh-64px)] p-4">
          <Link to="/dashboard" className="text-sm block mb-6">
            ← Back to Dashboard
          </Link>

          <p className="text-xs font-semibold mb-4">
            COURSE CONTENT
          </p>

          {course.modules?.map((module) => (
            <div key={module._id}>
              <button
                onClick={() => toggleModule(module._id)}
                className="w-full flex justify-between px-3 py-2 rounded-lg text-left text-sm"
              >
                <span>
                  Module {module.order}: {module.title}
                </span>
                <span>{openModuleId === module._id ? "▾" : "▸"}</span>
              </button>

              {openModuleId === module._id && (
                <ul className="ml-3 mt-2 space-y-1">
                  {module.lessons?.map((lesson) => (
                    <li
                      key={lesson._id}
                      onClick={() => handleLessonClick(lesson._id)}
                      className="cursor-pointer px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {module.order}.{lesson.orderNo} {lesson.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-8">
          <h1 className="text-4xl font-bold mb-4">
            {course.title}
          </h1>

          {course.description && (
            <p className="text-gray-600 dark:text-slate-300 mb-8">
              {course.description}
            </p>
          )}

          <div
            onClick={() => navigate(`/courses/${courseId}/quiz`)}
            className="cursor-pointer bg-slate-900 text-white rounded-xl p-8"
          >
            <h3 className="text-2xl font-semibold">
              Final Course Quiz
            </h3>
          </div>
        </main>
      </div>
    </div>
  );
}
