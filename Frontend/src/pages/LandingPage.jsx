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
  Check 
} from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-[calc(100vh-3.75rem)] flex flex-col justify-between bg-[#f8fafc]">
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 w-full">
        
        {/* Top Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Node.js • Drizzle ORM • PostgreSQL • React
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Hostel Management System
          </h1>
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            A minimalist web application for managing room maintenance tickets, digital leave outpasses, and daily mess food menus.
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
          
          {/* Student Portal */}
          <div className="ui-card p-6 sm:p-8 rounded-2xl flex flex-col justify-between bg-white border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <Users className="w-5 h-5" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Student Portal</h2>
              <p className="text-slate-600 text-xs leading-relaxed mb-6">
                File maintenance requests, track issue timelines, and generate digital leave passes.
              </p>

              <ul className="space-y-2.5 mb-8 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>File complaints with photo attachments</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Download approved PDF leave passes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>View & rate daily mess menus</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <Link
                to="/student/login"
                className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs text-center transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Student Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/student/register"
                className="py-2.5 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                Register
              </Link>
            </div>
          </div>

          {/* Warden Portal */}
          <div className="ui-card p-6 sm:p-8 rounded-2xl flex flex-col justify-between bg-white border-slate-200">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 mb-2">Warden Portal</h2>
              <p className="text-slate-600 text-xs leading-relaxed mb-6">
                Administrative dashboard for resolving complaints, approving leave passes, and managing mess menus.
              </p>

              <ul className="space-y-2.5 mb-8 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Warden dashboard with ticket queues</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Digital signature leave approvals</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mess menu editor & feedback stats</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <Link
                to="/admin/login"
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs text-center transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Warden Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/admin/register"
                className="py-2.5 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
              >
                Register
              </Link>
            </div>
          </div>

        </div>

        {/* Feature Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div className="ui-panel p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              <span>Complaint Management</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Ticket tracking with category tags, room numbers, and proof attachments.
            </p>
          </div>

          <div className="ui-panel p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-600" />
              <span>Digital PDF Pass</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Outpass approval workflow generating digitally signed PDF passes.
            </p>
          </div>

          <div className="ui-panel p-4 rounded-xl border border-slate-200 space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
              <span>Mess Quality Control</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Daily menu schedule manager and student feedback metrics.
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <p>HostelMate • Modern Relational Database Architecture</p>
      </footer>
    </div>
  );
};

export default LandingPage;
