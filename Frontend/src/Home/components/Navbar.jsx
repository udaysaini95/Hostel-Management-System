import { Link } from "react-router-dom";


const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md shadow-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* Logo / Project Name */}
          <Link to="/" className="flex items-center gap-2 group">
            {/* Icon Placeholder */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:shadow-blue-500/50 transition-all">
              H
            </div>
            <span className="text-2xl font-bold text-white tracking-wide group-hover:text-blue-200 transition-colors">
              Hostel<span className="text-blue-400 font-light">Mate</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-300 hover:text-white font-medium text-sm tracking-wide uppercase transition-colors duration-200 hover:underline underline-offset-4 decoration-blue-500">
              Home
            </Link>

            <Link to="/about" className="text-gray-300 hover:text-white font-medium text-sm tracking-wide uppercase transition-colors duration-200 hover:underline underline-offset-4 decoration-blue-500">
              About
            </Link>

            <Link to="/contact" className="ml-4 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-cyan-500/30 hover:brightness-110 transition-all duration-300 transform hover:-translate-y-0.5">
              Contact Us
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button className="text-gray-300 hover:text-white focus:outline-none">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;