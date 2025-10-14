// Import Navigate and Outlet components from react-router-dom
// Navigate: allows us to redirect to another route
// Outlet: acts as a placeholder to render nested child routes
import { Navigate, Outlet } from "react-router-dom";

// Import our custom authentication hook from the context
// It provides access to authentication state (e.g. logged in or not)
import { useAuth } from "../context/AuthContext.jsx";

// Define the ProtectedRoute component
function ProtectedRoute() {
  // Destructure authentication data from the AuthContext
  // - isAuthenticated → true if the user is logged in
  // - isLoading → true while checking the login/session status
  const { isAuthenticated, isLoading } = useAuth();

  // If authentication check is still loading, show a loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking your session…</p>
      </div>
    );
  }

  // If the user is NOT authenticated, redirect them to the login page
  // `replace` ensures the redirect replaces the current entry in history
  // (so they can’t go back to the protected page via the back button)
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // If authenticated, render the nested routes (the protected content)
  // The <Outlet /> is where the child route components will appear
  return <Outlet />;
}

// Export the ProtectedRoute component so it can be used in routing setup
export default ProtectedRoute;
