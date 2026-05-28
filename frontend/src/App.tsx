import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute, {
  getHomePath,
} from "@/components/auth/ProtectedRoute";
import NotificationToasts from "@/components/layout/NotificationToasts";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "./components/layout/AdminLayout";
import EmployeeLayout from "./components/layout/EmployeeLayout";
import AuthLayout from "./components/layout/AuthLayout";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DashboardPage from "./pages/admin/DashboardPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import RolesPage from "./pages/admin/RolesPage";
import PermissionsPage from "./pages/admin/PermissionsPage";
import AdminProfilePage from "./pages/admin/ProfilePage";
import TaskControlPage from "./pages/manager/TaskControlPage";
import BoardPage from "./pages/employee/BoardPage";
import EmployeeProfilePage from "./pages/employee/ProfilePage";
import { PermissionCode, getManageHomePath } from "./lib/permissions";

function RootRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role.code === "ADMIN" || user.role.code === "MANAGER") {
    return <Navigate to={getManageHomePath(user)} replace />;
  }

  return <Navigate to={getHomePath(user.role.code)} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN", "MANAGER"]} />}>
          <Route path="/manage" element={<AdminLayout />}>
            <Route index element={<RootRedirect />} />

            <Route element={<ProtectedRoute permissions={[PermissionCode.DashboardRead]} />}>
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={[PermissionCode.UserManage]} />}>
              <Route path="users" element={<UserManagementPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={[PermissionCode.TaskAssign]} />}>
              <Route path="tasks" element={<TaskControlPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={[PermissionCode.RoleManage]} />}>
              <Route path="roles" element={<RolesPage />} />
            </Route>

            <Route element={<ProtectedRoute permissions={[PermissionCode.PermissionManage]} />}>
              <Route path="permissions" element={<PermissionsPage />} />
            </Route>

            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN", "EMPLOYEE"]} />}>
          <Route element={<EmployeeLayout />}>
            <Route path="/board" element={<BoardPage />} />
            <Route path="/profile" element={<EmployeeProfilePage />} />
          </Route>
        </Route>

        <Route path="/admin/*" element={<Navigate to="/manage" replace />} />
        <Route path="/manager/*" element={<Navigate to="/manage" replace />} />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
      <NotificationToasts />
    </BrowserRouter>
  );
}

export default App;
