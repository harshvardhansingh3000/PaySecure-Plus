import { StrictMode } from "react"; // Helps identify potential problems in an application in development
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Register from "./pages/Register.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import Payments from "./pages/Payments.jsx";
import FraudRules from "./pages/FraudRules.jsx";

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/auth/login", element: <Login /> },
  { path: "/auth/register", element: <Register /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/payments", element: <Payments /> },
      { path: "/fraud/rules", element: <FraudRules /> },
      { path: "/admin/users", element: <AdminUsers /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>
);