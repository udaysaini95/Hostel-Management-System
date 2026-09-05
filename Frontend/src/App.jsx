import { Route, Routes } from "react-router-dom";
import { AuthenticatedShell } from "./layouts/AuthenticatedShell.jsx";
import { PublicShell } from "./layouts/PublicShell.jsx";

import AdminDashboard from "./pages/AdminDashboard";
import AdminLeaves from "./pages/AdminLeaves";
import AllComplaintsAdmin from "./pages/AllComplaintsAdmin";
import ApplyLeave from "./pages/ApplyLeave";
import GuardTerminal from "./pages/GuardTerminal";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MessAdmin from "./pages/MessAdmin";
import MessPage from "./pages/MessPage";
import MyComplaints from "./pages/MyComplaints";
import MyLeaves from "./pages/MyLeaves";
import RaiseComplaint from "./pages/RaiseComplaint";
import StudentDashboard from "./pages/StudentDashboard";
import StudentRegister from "./pages/StudentRegister";

function App() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route index element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<StudentRegister />} />

        <Route path="/student/login" element={<LoginPage />} />
        <Route path="/student/register" element={<StudentRegister />} />
        <Route path="/admin/login" element={<LoginPage />} />
      </Route>

      <Route element={<AuthenticatedShell />}>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/complaints" element={<MyComplaints />} />
        <Route
          path="/student/complaints/raise"
          element={<RaiseComplaint />}
        />
        <Route path="/student/leaves" element={<MyLeaves />} />
        <Route path="/student/leaves/apply" element={<ApplyLeave />} />
        <Route path="/student/mess" element={<MessPage />} />

        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/complaints" element={<AllComplaintsAdmin />} />
        <Route path="/admin/leaves" element={<AdminLeaves />} />
        <Route path="/admin/mess" element={<MessAdmin />} />

        <Route path="/guard/terminal" element={<GuardTerminal />} />
      </Route>
    </Routes>
  );
}

export default App;
