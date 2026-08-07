import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { Calendar, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

const ApplyLeave = () => {
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason) {
      setError("Please fill in dates and reason for leave.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api.post("/api/leave/apply", {
        reason,
        fromDate,
        toDate,
      });

      navigate("/student/leaves");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to submit leave application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      
      <Link
        to="/student/leaves"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Leaves</span>
      </Link>

      <div className="ui-panel p-6 sm:p-8 rounded-2xl bg-white border-slate-200 shadow-xs">
        
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Apply for Gate Pass / Leave
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Submit leave request for warden digital signature & PDF outpass generation.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Leave
            </label>
            <textarea
              required
              rows={4}
              placeholder="State your reason (e.g. Going home for weekend)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg ui-input text-xs resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Submitting..." : "Submit Leave Application"}
          </button>

        </form>

      </div>
    </div>
  );
};

export default ApplyLeave;
