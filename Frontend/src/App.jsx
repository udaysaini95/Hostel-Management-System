import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

// Pages
import LandingPage from "./pages/LandingPage";
import StudentLogin from "./pages/StudentLogin";
import StudentRegister from "./pages/StudentRegister";
import StudentDashboard from "./pages/StudentDashboard";
import RaiseComplaint from "./pages/RaiseComplaint";
import MyComplaints from "./pages/MyComplaints";
import ApplyLeave from "./pages/ApplyLeave";
import MyLeaves from "./pages/MyLeaves";
import MessPage from "./pages/MessPage";

import AdminLogin from "./pages/AdminLogin";
import AdminRegister from "./pages/AdminRegister";
import AdminDashboard from "./pages/AdminDashboard";
import AllComplaintsAdmin from "./pages/AllComplaintsAdmin";
import AdminLeaves from "./pages/AdminLeaves";
import MessAdmin from "./pages/MessAdmin";

function App() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1">
        <Routes>
          {/* Public Landing & Auth Routes */}
          <Route path="/" element={<LandingPage />} />
          
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/register" element={<StudentRegister />} />
          
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />

          {/* Student Portal Routes */}
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/complaints" element={<MyComplaints />} />
          <Route path="/student/complaints/raise" element={<RaiseComplaint />} />
          <Route path="/student/leaves" element={<MyLeaves />} />
          <Route path="/student/leaves/apply" element={<ApplyLeave />} />
          <Route path="/student/mess" element={<MessPage />} />

          {/* Warden / Admin Portal Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/complaints" element={<AllComplaintsAdmin />} />
          <Route path="/admin/leaves" element={<AdminLeaves />} />
          <Route path="/admin/mess" element={<MessAdmin />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
