import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import StudentRegister from "./pages/StudentRegister";
import StudentDashboard from "./pages/StudentDashboard";
import RaiseComplaint from "./pages/RaiseComplaint";
import MyComplaints from "./pages/MyComplaints";
import ApplyLeave from "./pages/ApplyLeave";
import MyLeaves from "./pages/MyLeaves";
import MessPage from "./pages/MessPage";

import AdminDashboard from "./pages/AdminDashboard";
import AllComplaintsAdmin from "./pages/AllComplaintsAdmin";
import AdminLeaves from "./pages/AdminLeaves";
import MessAdmin from "./pages/MessAdmin";
import GuardTerminal from "./pages/GuardTerminal";

function App() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col font-sans">
      <Navbar />

      <div className="flex-1">
        <Routes>
          {/* Public Landing & Unified Auth */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<StudentRegister />} />

          {/* Legacy Redirects */}
          <Route path="/student/login" element={<LoginPage />} />
          <Route path="/student/register" element={<StudentRegister />} />
          <Route path="/admin/login" element={<LoginPage />} />

          {/* Gate Guard Terminal Route */}
          <Route path="/guard/terminal" element={<GuardTerminal />} />

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
