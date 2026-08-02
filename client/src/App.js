import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";
import AIQuestionPage from "./AIQuestionPage";
import QuestionPage from "./QuestionPage";
import Dashboard from "./Dashboard";
import ProtectedRoute from "./ProtectedRoute";
import VerifyEmail from "./VerifyEmail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai"
          element={
            <ProtectedRoute>
              <AIQuestionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/test"
          element={
            <ProtectedRoute>
              <QuestionPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}