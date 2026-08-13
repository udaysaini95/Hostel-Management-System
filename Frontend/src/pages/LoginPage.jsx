import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { ArrowLeft, AlertCircle, LogIn, Lock, Mail } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/login", { email, password });
      
      const userRole = res.data.role || res.data.user?.role || "student";
      const token = res.data.token;
      const user = res.data.user || { name: email.split("@")[0], email, role: userRole };

      localStorage.setItem("token", token);
      localStorage.setItem("role", userRole);
      localStorage.setItem("user", JSON.stringify(user));

      // Smart Dynamic Role-Based Redirect
      if (userRole === "admin" || userRole === "warden") {
        navigate("/admin/dashboard");
      } else if (userRole === "guard") {
        navigate("/guard/terminal");
      } else {
        navigate("/student/dashboard");
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.message || err.response?.data || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.75rem)] flex items-center justify-center p-4 bg-[#f8fafc]">
      <div className="w-full max-w-sm">
        
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>

        <div className="ui-panel p-6 sm:p-8 rounded-2xl bg-white border-slate-200 shadow-sm space-y-6">
          
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Sign In to HostelMate
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Unified portal for Students, Wardens, and Gate Security
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@hostel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg ui-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg ui-input text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </button>

          </form>

          <div className="text-center border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              New resident student?{" "}
              <Link to="/register" className="text-indigo-600 hover:underline font-semibold">
                Create Student Account
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
