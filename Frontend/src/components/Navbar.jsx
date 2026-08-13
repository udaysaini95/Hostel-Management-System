import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { 
  Building2, 
  LogOut, 
  User, 
  Menu as MenuIcon, 
  X, 
  ShieldCheck, 
  LayoutDashboard, 
  AlertCircle, 
  FileText, 
  Utensils,
  QrCode
} from "lucide-react";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const userStr = localStorage.getItem("user");
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    user = null;
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tracking-tight">
                HostelMate
              </span>
              <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                v1.0
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {token ? (
              role === "admin" || role === "warden" ? (
                <>
                  <Link
                    to="/admin/dashboard"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/admin/dashboard")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Dashboard
                  </Link>

                  <Link
                    to="/guard/terminal"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/guard/terminal")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    Gate Terminal
                  </Link>

                  <Link
                    to="/admin/complaints"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/admin/complaints")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Complaints
                  </Link>

                  <Link
                    to="/admin/leaves"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/admin/leaves")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Leave Passes
                  </Link>

                  <Link
                    to="/admin/mess"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/admin/mess")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    Mess Admin
                  </Link>
                </>
              ) : role === "guard" ? (
                <>
                  <Link
                    to="/guard/terminal"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/guard/terminal")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    Gate Terminal
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/student/dashboard"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/student/dashboard")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Dashboard
                  </Link>

                  <Link
                    to="/student/complaints"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/student/complaints")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Complaints
                  </Link>

                  <Link
                    to="/student/leaves"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/student/leaves")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Leaves
                  </Link>

                  <Link
                    to="/student/mess"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                      isActive("/student/mess")
                        ? "bg-slate-100 text-slate-900 border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    Mess Menu
                  </Link>
                </>
              )
            ) : null}
          </nav>

          {/* Right Action Section */}
          <div className="hidden md:flex items-center gap-3">
            {token ? (
              <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="text-xs font-medium text-slate-800">
                    {user?.name || "User"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono capitalize">
                    ({role})
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-2">
          {token ? (
            <>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 mb-2">
                Logged in as <strong className="text-slate-900">{user?.name}</strong> ({role})
              </div>
              <Link
                to={role === "admin" || role === "warden" ? "/admin/dashboard" : role === "guard" ? "/guard/terminal" : "/student/dashboard"}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Dashboard
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center px-3 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
