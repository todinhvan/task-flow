import { Outlet, useLocation } from "react-router-dom";
import { EmployeeBoardProvider } from "@/context/EmployeeBoardContext";
import EmployeeTopBar from "./EmployeeTopBar";

export default function EmployeeLayout() {
  const location = useLocation();
  const isBoardRoute = location.pathname.startsWith("/board");

  return (
    <EmployeeBoardProvider>
      <main className="flex h-screen w-full flex-1 flex-col bg-surface-bright">
        <EmployeeTopBar />
        <div className={isBoardRoute ? "min-h-0 flex-1 overflow-hidden" : "flex-1 overflow-y-auto"}>
          <Outlet />
        </div>
      </main>
    </EmployeeBoardProvider>
  );
}
