import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type EmployeeBoardContextValue = {
  assignedPanelOpen: boolean;
  searchQuery: string;
  setAssignedPanelOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleAssignedPanel: () => void;
};

const EmployeeBoardContext = createContext<
  EmployeeBoardContextValue | undefined
>(undefined);

function getInitialAssignedPanelState() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.innerWidth >= 1024;
}

export function EmployeeBoardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedPanelOpen, setAssignedPanelOpen] = useState(
    getInitialAssignedPanelState,
  );

  const value = useMemo<EmployeeBoardContextValue>(
    () => ({
      assignedPanelOpen,
      searchQuery,
      setAssignedPanelOpen,
      setSearchQuery,
      toggleAssignedPanel: () => {
        setAssignedPanelOpen((current) => !current);
      },
    }),
    [assignedPanelOpen, searchQuery],
  );

  return (
    <EmployeeBoardContext.Provider value={value}>
      {children}
    </EmployeeBoardContext.Provider>
  );
}

export function useEmployeeBoard() {
  const context = useContext(EmployeeBoardContext);

  if (!context) {
    throw new Error(
      "useEmployeeBoard must be used within EmployeeBoardProvider",
    );
  }

  return context;
}
