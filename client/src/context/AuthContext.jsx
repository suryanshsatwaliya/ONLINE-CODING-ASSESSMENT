import { createContext, useState } from "react";
export const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  function login(data) {
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }
  function updateUser(nextUser) {
    sessionStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
  }
  function logout() {
    sessionStorage.clear();
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
