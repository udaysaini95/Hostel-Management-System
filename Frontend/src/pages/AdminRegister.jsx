import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { ArrowLeft, AlertCircle } from "lucide-react";

const AdminRegister = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/register", {
        name,
        email,
        password,
        role: "admin",
      });

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("role", "admin");
        localStorage.setItem("user", JSON.stringify(res.data.user || { name, email, role: "admin" }));
        navigate("/admin/dashboard");
      } else {
        navigate("/admin/login");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.response?.data || "Warden registration failed. Please try again.");
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

        <div className="ui-panel p-6 sm:p-8 rounded-2xl bg-white border-slate-200 shadow-sm">
          
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Register Warden Account
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Create an administrative account
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Warden Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Dr. Rajesh Verma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Warden Email
              </label>
              <input
                type="email"
                required
                placeholder="warden@hostel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Registering..." : "Create Admin Account"}
            </button>

          </form>

          <div className="mt-6 text-center border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Already registered?{" "}
              <Link to="/admin/login" className="text-emerald-600 hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminRegister;
