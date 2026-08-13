import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import { 
  ShieldCheck, 
  Search, 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  XCircle, 
  LogOut, 
  LogIn, 
  User, 
  Calendar, 
  Phone, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  Users
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

const GuardTerminal = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [outsideStudents, setOutsideStudents] = useState([]);
  const [logs, setLogs] = useState([]);

  const fetchLiveRoster = async () => {
    try {
      const [outsideRes, logsRes] = await Promise.allSettled([
        api.get("/api/gate/active-outside"),
        api.get("/api/gate/logs"),
      ]);

      if (outsideRes.status === "fulfilled") setOutsideStudents(outsideRes.value.data || []);
      if (logsRes.status === "fulfilled") setLogs(logsRes.value.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLiveRoster();
    const interval = setInterval(fetchLiveRoster, 15000); // 15s polling
    return () => clearInterval(interval);
  }, []);

  // In-Browser HTML5 Camera Scanner
  useEffect(() => {
    let scanner = null;
    if (scannerOpen) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(
        (decodedText) => {
          setQuery(decodedText);
          handleSearch(decodedText);
          scanner.clear();
          setScannerOpen(false);
        },
        (scanError) => {
          // ignore transient scan frames
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch((e) => console.log(e));
      }
    };
  }, [scannerOpen]);

  const handleSearch = async (searchVal) => {
    const val = (searchVal || query).trim();
    if (!val) return;

    setLoading(true);
    setError("");
    setActionSuccess("");
    setResult(null);

    try {
      const res = await api.post("/api/gate/verify", { identifier: val });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "No valid pass found for this Roll No or Pass Code.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogAction = async (action) => {
    if (!result || !result.leave) return;

    setLoading(true);
    try {
      const res = await api.post("/api/gate/log-action", {
        leaveId: result.leave.leaveId || result.leave.id,
        action: action, // "EXIT" or "ENTRY"
      });

      setActionSuccess(res.data.message);
      // Re-verify to update state card
      handleSearch(query);
      fetchLiveRoster();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to log action.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Header Banner */}
      <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-800 mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Gate Security Terminal
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Hostel Gate Pass & Attendance Verification
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Verify student gate outpasses via Roll Number, Pass Code, or Camera QR Scanner.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScannerOpen(!scannerOpen)}
            className={`py-2 px-3.5 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 ${
              scannerOpen 
                ? "bg-slate-800 text-white" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {scannerOpen ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            <span>{scannerOpen ? "Close Camera" : "Open Camera Scanner"}</span>
          </button>
        </div>
      </div>

      {/* Camera Scanner Viewport */}
      {scannerOpen && (
        <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs text-center space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Point Camera at Student QR Code</h3>
          <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl"></div>
        </div>
      )}

      {/* Quick Search Bar */}
      <div className="ui-panel p-5 rounded-2xl bg-white border-slate-200 shadow-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Enter Student Roll No (e.g. 21BCS104) or Pass Code (e.g. LP-4821)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg ui-input text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto py-2.5 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? "Verifying..." : "Verify Gate Pass"}
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Verification Card */}
      {result && result.leave && (
        <div className="ui-panel p-6 sm:p-8 rounded-2xl bg-white border-slate-200 shadow-sm space-y-6">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xl font-bold">
                {result.leave.student?.name?.charAt(0) || "S"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{result.leave.student?.name || "Student"}</h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span><strong>Roll No:</strong> {result.leave.student?.rollNo || "N/A"}</span>
                  <span>•</span>
                  <span><strong>Room:</strong> {result.leave.student?.roomNo || "N/A"}</span>
                  <span>•</span>
                  <span><strong>Pass:</strong> <span className="font-mono font-bold text-slate-900">{result.leave.passCode}</span></span>
                </div>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
              result.leave.status === "Approved"
                ? "badge-resolved"
                : result.leave.status === "Exited"
                ? "badge-pending"
                : "badge-created"
            }`}>
              {result.leave.status === "Approved" 
                ? "🟢 Approved (Ready to Exit)" 
                : result.leave.status === "Exited" 
                ? "🟡 Outside Campus (Ready for Entry)" 
                : result.leave.status}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Approved Dates</span>
              <div className="text-slate-800 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{result.leave.fromDate} ➔ {result.leave.toDate}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Reason for Leave</span>
              <div className="text-slate-800 font-medium">{result.leave.reason || "N/A"}</div>
            </div>
          </div>

          {/* State Action Controls */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {result.canExit && (
              <button
                onClick={() => handleLogAction("EXIT")}
                disabled={loading}
                className="flex-1 w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>ALLOW & LOG EXIT (DEPARTURE)</span>
              </button>
            )}

            {result.canEnter && (
              <button
                onClick={() => handleLogAction("ENTRY")}
                disabled={loading}
                className="flex-1 w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>LOG ENTRY (STUDENT RETURNED)</span>
              </button>
            )}
          </div>

        </div>
      )}

      {/* Bottom Section: Real-time Live Outside Roster */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span>Students Currently Outside Campus ({outsideStudents.length})</span>
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">Live Sync (15s)</span>
        </div>

        {outsideStudents.length === 0 ? (
          <div className="ui-panel p-6 rounded-xl text-center text-xs text-slate-500">
            No students are currently outside campus. All residents accounted for.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {outsideStudents.map((s) => (
              <div key={s.leaveId} className="ui-card p-4 rounded-xl bg-white border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900">{s.student?.name}</div>
                  <div className="text-[11px] text-slate-500">
                    Roll: {s.student?.rollNo || "N/A"} • Room: {s.student?.roomNo || "N/A"}
                  </div>
                  <div className="text-[10px] text-amber-700 font-mono mt-1">
                    Exited at: {s.leftAt ? new Date(s.leftAt).toLocaleTimeString() : "Earlier"}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setQuery(s.passCode || s.student?.rollNo || "");
                    handleSearch(s.passCode || s.student?.rollNo);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                >
                  Check-In
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default GuardTerminal;
