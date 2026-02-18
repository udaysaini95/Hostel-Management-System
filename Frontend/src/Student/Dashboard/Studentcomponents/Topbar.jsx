import { Menu, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Topbar = ({ toggleSidebar }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/student/login");
  };

  return (
    <div className="
      fixed top-0 left-0 right-0
      h-16 bg-slate-900/95 backdrop-blur-md shadow-lg border-b border-white/10
      flex items-center justify-between
      px-6 md:px-10 z-50
    ">
      {/* Background accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>

      {/* LEFT */}
      <div className="flex items-center gap-4">
        {/* MOBILE TOGGLE */}
        <button
          onClick={toggleSidebar}
          className="p-2 -ml-2 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white md:hidden transition-all"
        >
          <Menu size={24} />
        </button>

        <div className="flex flex-col">
          <h2 className="font-bold text-lg text-white tracking-wide">
            Student <span className="text-blue-400 font-light">Dashboard</span>
          </h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider hidden sm:block">
            Hostel Management Portal
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4 md:gap-6">
        <button
          onClick={() => alert("Profile clicked")}  // You might want to navigate to profile page eventually
          className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all text-gray-300 hover:text-white"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <User size={16} className="text-white" />
          </div>
          <span className="text-sm font-medium hidden md:block">My Profile</span>
        </button>

        <div className="h-8 w-px bg-white/10 hidden md:block"></div> {/* Divider */}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors text-sm font-medium hover:bg-rose-500/10 px-3 py-1.5 rounded-lg"
        >
          <LogOut size={18} />
          <span className="hidden md:block">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Topbar;
