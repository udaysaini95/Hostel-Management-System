import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import api from "../api/axios";
import { Button, Input, Panel } from "../components/ui";

const StudentRegister = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/register", {
        name,
        email,
        password,
        role: "student",
      });

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("role", "student");
        localStorage.setItem(
          "user",
          JSON.stringify(
            response.data.user || { name, email, role: "student" }
          )
        );
        navigate("/student/dashboard");
      } else {
        navigate("/student/login");
      }
    } catch (requestError) {
      console.error("Registration error:", requestError);
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.75rem)] flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-small font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to home</span>
        </Link>

        <Panel>
          <div className="mb-6">
            <h1 className="text-section-title font-bold text-text-primary">
              Create student account
            </h1>
            <p className="mt-1 text-small text-text-secondary">
              Register with the student email assigned by your institution.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 flex items-start gap-2 rounded-md border border-danger-border bg-danger-soft p-3 text-small text-danger"
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
              label="Full name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Rahul Sharma"
              value={name}
              onChange={(changeEvent) => setName(changeEvent.target.value)}
              required
            />

            <Input
              label="Student email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="student@college.edu"
              value={email}
              onChange={(changeEvent) => setEmail(changeEvent.target.value)}
              required
            />

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              hint="Use at least 12 characters."
              minLength={12}
              value={password}
              onChange={(changeEvent) => setPassword(changeEvent.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="form"
              fullWidth
              loading={loading}
              loadingLabel="Creating account"
            >
              Create account
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-small text-text-secondary">
              Already registered?{" "}
              <Link
                to="/login"
                className="font-semibold text-brand hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default StudentRegister;
