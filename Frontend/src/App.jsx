import { Route, Routes } from "react-router-dom";
import {
  GuestOnly,
  RequireAuthentication,
  RequireRole,
} from "./auth/RouteGuards.jsx";
import { ROLE_GROUPS } from "./auth/routeAccess.js";
import { AuthenticatedShell } from "./layouts/AuthenticatedShell.jsx";
import { PublicShell } from "./layouts/PublicShell.jsx";

import AdminDashboard from "./pages/AdminDashboard";
import AdminLeaves from "./pages/AdminLeaves";
import ApprovedStudents from "./pages/ApprovedStudents.jsx";
import AllComplaintsAdmin from "./pages/AllComplaintsAdmin";
import ApplyLeave from "./pages/ApplyLeave";
import GuardTerminal from "./pages/GuardTerminal";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MessAdmin from "./pages/MessAdmin";
import MessPage from "./pages/MessPage";
import MyComplaints from "./pages/MyComplaints";
import MyLeaves from "./pages/MyLeaves";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RaiseComplaint from "./pages/RaiseComplaint";
import StudentActivationComplete from "./pages/StudentActivationComplete.jsx";
import StudentActivationRequest from "./pages/StudentActivationRequest.jsx";
import StudentDashboard from "./pages/StudentDashboard";
import UnauthorizedPage from "./pages/UnauthorizedPage.jsx";

function App() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route index element={<LandingPage />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<StudentActivationRequest />} />
          <Route path="/student/login" element={<LoginPage />} />
          <Route
            path="/student/register"
            element={<StudentActivationRequest />}
          />
          <Route path="/admin/login" element={<LoginPage />} />
        </Route>
        <Route
          path="/activate-student"
          element={<StudentActivationComplete />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<RequireAuthentication />}>
        <Route element={<AuthenticatedShell />}>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<RequireRole allowedRoles={ROLE_GROUPS.STUDENT} />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/complaints" element={<MyComplaints />} />
            <Route
              path="/student/complaints/raise"
              element={<RaiseComplaint />}
            />
            <Route path="/student/leaves" element={<MyLeaves />} />
            <Route path="/student/leaves/apply" element={<ApplyLeave />} />
          </Route>

          <Route element={<RequireRole allowedRoles={ROLE_GROUPS.MESS_READER} />}>
            <Route path="/student/mess" element={<MessPage />} />
          </Route>

          <Route element={<RequireRole allowedRoles={ROLE_GROUPS.OPERATIONS} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/complaints" element={<AllComplaintsAdmin />} />
            <Route path="/admin/leaves" element={<AdminLeaves />} />
            <Route path="/admin/mess" element={<MessAdmin />} />
          </Route>

          <Route element={<RequireRole allowedRoles={ROLE_GROUPS.ADMIN} />}>
            <Route
              path="/admin/student-approvals"
              element={<ApprovedStudents />}
            />
          </Route>

          <Route element={<RequireRole allowedRoles={ROLE_GROUPS.GATE_TERMINAL} />}>
            <Route path="/guard/terminal" element={<GuardTerminal />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
