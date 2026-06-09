/**
 * App.jsx
 *
 * Bug #5 fix: Added missing /analytics route.
 * Bug #6 fix: All authenticated pages wrapped in <ProtectedRoute>.
 */

import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";

import UploadForm      from "./components/UploadForm";
import HistoryPage     from "./pages/HistoryPage";
import CallDetailsPage from "./pages/CallDetailsPage";
import DashboardPage   from "./pages/DashboardPage";
import AnalyticsPage   from "./pages/AnalyticsPage";
import LandingPage     from "./pages/LandingPage";
import LoginPage       from "./pages/LoginPage";
import SignupPage      from "./pages/SignupPage";
import ProtectedRoute  from "./components/ProtectedRoute";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/"         element={<LandingPage />} />
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/signup"   element={<SignupPage />} />
                <Route path="/register" element={<SignupPage />} />

                {/* Protected routes — redirect to /login if no valid JWT */}
                <Route path="/dashboard" element={
                    <ProtectedRoute><DashboardPage /></ProtectedRoute>
                } />
                <Route path="/history" element={
                    <ProtectedRoute><HistoryPage /></ProtectedRoute>
                } />
                <Route path="/calls/:id" element={
                    <ProtectedRoute><CallDetailsPage /></ProtectedRoute>
                } />
                <Route path="/analytics" element={
                    <ProtectedRoute><AnalyticsPage /></ProtectedRoute>
                } />
                <Route path="/upload" element={
                    <ProtectedRoute><UploadForm /></ProtectedRoute>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
