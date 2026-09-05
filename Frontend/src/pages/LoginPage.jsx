import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Lock, Mail } from "lucide-react";
import api from "../api/axios";
import { Button, Input, Panel } from "../components/ui";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/login", { email, password });
      const userRole = response.data.role || response.data.user?.role || "student";
      const token = response.data.token;
      const user = response.data.user || {
        name: email.split("@")[0],
        email,
        role: userRole,
      };

      localStorage.setItem("token", token);
      localStorage.setItem("role", userRole);
      localStorage.setItem("user", JSON.stringify(user));

      if (userRole === "admin" || userRole === "warden") {
        navigate("/admin/dashboard");
      } else if (userRole === "guard") {
        navigate("/guard/terminal");
      } else if (userRole === "maintenance") {
        navigate("/student/mess");
      } else {
        navigate("/student/dashboard");
      }
    } catch (requestError) {
      console.error("Login error:", requestError);
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data ||
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-small font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to home</span>
        </Link>

        <Panel className="space-y-6">
          <div>
            <h1 className="text-section-title font-bold text-text-primary">
              Sign in to HostelMate
            </h1>
            <p className="mt-1 text-small text-text-secondary">
              Use your assigned student or staff email.
            </p>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-soft p-3 text-small text-danger"
              role="alert"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@college.edu"
              value={email}
              onChange={(changeEvent) => setEmail(changeEvent.target.value)}
              startIcon={<Mail />}
              required
            />

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(changeEvent) => setPassword(changeEvent.target.value)}
              startIcon={<Lock />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="form"
              fullWidth
              loading={loading}
              loadingLabel="Signing in"
            >
              Sign in
            </Button>
          </form>

          <div className="border-t border-border pt-4 text-center">
            <p className="text-small text-text-secondary">
              New resident student?{" "}
              <Link
                to="/register"
                className="font-semibold text-brand hover:underline"
              >
                Create student account
              </Link>
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default LoginPage;
