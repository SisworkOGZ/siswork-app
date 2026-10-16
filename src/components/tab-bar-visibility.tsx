import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

type TabBarVisibilityContextValue = {
  isTabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (conversationId: string | null) => void;
};

const TabBarVisibilityContext =
  createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({ children }: PropsWithChildren) {
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const setTabBarHidden = useCallback((hidden: boolean) => {
    setIsTabBarHidden(hidden);
  }, []);
  const value = useMemo(
    () => ({
      isTabBarHidden,
      setTabBarHidden,
      selectedConversationId,
      setSelectedConversationId,
    }),
    [
      isTabBarHidden,
      setTabBarHidden,
      selectedConversationId,
      setSelectedConversationId,
    ],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error(
      "useTabBarVisibility harus digunakan di dalam TabBarVisibilityProvider.",
    );
  }
  return context;
}
