import RoleCard from "./components/RoleCard";

const Home = () => {
  return (
    // Responsive container: scrollable on mobile (min-h-screen), fixed on desktop (h-[calc(100vh-5rem)])
    <div className="min-h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-4 py-8 md:py-0 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat relative">

      {/* Elegant Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-900/80 backdrop-blur-[2px] z-0"></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col items-center">

        <div className="text-center mb-8 md:mb-10 space-y-3 md:space-y-4">

          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white tracking-tight drop-shadow-2xl leading-tight whitespace-normal md:whitespace-nowrap">
            Elevate Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-white block md:inline mt-1 md:mt-0">Campus Experience</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-xl md:max-w-2xl mx-auto font-light leading-relaxed px-2">
            Seamlessly manage complaints and stay connected with your hostel community.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full justify-center items-center pb-8 md:pb-0">

          {/* STUDENT CARD */}
          <RoleCard
            title="Student"
            image="https://cdn-icons-png.flaticon.com/512/3135/3135755.png"
            loginPath="/student/login"
            registerPath="/student/register"
          />

          {/* ADMIN CARD */}
          <RoleCard
            title="Admin"
            image="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
            loginPath="/admin/login"
            registerPath="/admin/register"
          />

        </div>
      </div>

      {/* Optional Footer - Hidden on very small screens if needed, or adjust position */}
      <div className="absolute bottom-2 text-gray-500 text-[10px] md:text-xs z-10 w-full text-center">
        © 2026 Hostel Management System. All rights reserved.
      </div>
    </div>
  );
};

export default Home;
