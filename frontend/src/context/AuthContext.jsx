import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchProfile() {
    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:3001/api/auth/profile", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const body = await response.json();
      setUser(body.data.user);
    } catch (fetchError) {
      console.error("Profile fetch failed", fetchError);
      setError("Unable to load session information.");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  async function login(email, password) {
    setError(null);
    const response = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(errorBody.message || "Login failed");
    }

    await fetchProfile();
  }

  async function logout() {
    try {
      await fetch("http://localhost:3001/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  }

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    logout,
    refresh: fetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}