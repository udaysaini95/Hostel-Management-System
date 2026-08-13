import React from "react";
import { Link } from "react-router-dom";
import { 
  Building2, 
  ShieldCheck, 
  Users, 
  AlertCircle, 
  FileCheck, 
  UtensilsCrossed, 
  ArrowRight, 
  Check,
  QrCode,
  Lock,
  Database,
  Cpu
} from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-[calc(100vh-3.75rem)] flex flex-col justify-between bg-[#f8fafc]">
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-20 w-full">
        
        {/* Top Architecture Pill */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            PostgreSQL • Drizzle ORM • RBAC Security • Express • React
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Hostel Operations & Gate Security Platform
          </h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            A unified digital ecosystem for resident students, hostel wardens, and gate security officers.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="py-2.5 px-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-2"
            >
              <span>Sign In to Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/register"
              className="py-2.5 px-5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 shadow-xs transition-colors"
            >
              Register Student
            </Link>
          </div>
        </div>

        {/* 3 Core Pillar Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          
          {/* Module 1: Resident Students */}
          <div className="ui-card p-6 rounded-2xl bg-white border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>

              <h2 className="text-base font-bold text-slate-900 mb-1.5">Resident Student Portal</h2>
              <p className="text-slate-600 text-xs leading-relaxed mb-4">
                Self-service room maintenance, digital outpass generation, and mess feedback.
              </p>

              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Raise tickets with photo proof</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Download QR-embedded PDF passes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Daily meal menu & star ratings</span>
                </li>
              </ul>
            </div>

            <Link
              to="/login"
              className="py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold text-center border border-slate-200 transition-colors block"
            >
              Access Student Portal ➔
            </Link>
          </div>

          {/* Module 2: Warden Administration */}
          <div className="ui-card p-6 rounded-2xl bg-white border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>

              <h2 className="text-base font-bold text-slate-900 mb-1.5">Warden Administration</h2>
              <p className="text-slate-600 text-xs leading-relaxed mb-4">
                Comprehensive hostel console for ticket queues, leave approvals, and dining.
              </p>

              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ticket resolution workflow</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Digital signature leave approval</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Live outside-campus roster</span>
                </li>
              </ul>
            </div>

            <Link
              to="/login"
              className="py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold text-center border border-slate-200 transition-colors block"
            >
              Access Warden Console ➔
            </Link>
          </div>

          {/* Module 3: Gate Security */}
          <div className="ui-card p-6 rounded-2xl bg-white border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
                <QrCode className="w-5 h-5" />
              </div>

              <h2 className="text-base font-bold text-slate-900 mb-1.5">Gate Security Terminal</h2>
              <p className="text-slate-600 text-xs leading-relaxed mb-4">
                High-throughput verification terminal for campus exit and entry logging.
              </p>

              <ul className="space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Roll No & Pass Code search</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>In-browser HTML5 camera scanner</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1-click departure & entry logging</span>
                </li>
              </ul>
            </div>

            <Link
              to="/login"
              className="py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold text-center border border-slate-200 transition-colors block"
            >
              Access Gate Terminal ➔
            </Link>
          </div>

        </div>

        {/* Technical Architecture Highlights Bar */}
        <div className="ui-panel p-6 rounded-2xl bg-white border-slate-200 shadow-xs max-w-5xl mx-auto space-y-4">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Key Technical Architecture
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600" />
                <span>Relational Schema Design</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Normalized PostgreSQL tables with Drizzle ORM managing cascaded relations.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Role-Based Access Control</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Granular JWT token middleware enforcing route-level role permissions.
              </p>
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-600" />
                <span>Gate State Machine</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Prevents pass reuse via one-time state transitions (<code className="text-slate-900">Approved ➔ Exited ➔ Returned</code>).
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <p>HostelMate • Production-Grade Web Architecture</p>
      </footer>
    </div>
  );
};

export default LandingPage;
