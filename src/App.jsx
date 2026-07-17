/**
 * App.jsx
 *
 * Bug #5 fix: Added missing /analytics route.
 * Bug #6 fix: All authenticated pages wrapped in <ProtectedRoute>.
 */

import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";

import UploadForm from "./components/UploadForm";
import HistoryPage from "./pages/HistoryPage";
import CallDetailsPage from "./pages/CallDetailsPage";
import DashboardPage from "./pages/DashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProtectedRoute from "./components/ProtectedRoute";
import LibraryPage from "./pages/LibraryPage.jsx";
import AIInsightsPage from "./pages/AIInsightsPage.jsx";
import ScorecardsPage from "./pages/ScorecardsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import CompanyDashboard from "./pages/CompanyDashboard.jsx";
import EmployeePerformancePage from "./pages/EmployeePerformancePage.jsx";
import EmployeeComparePage from "./pages/EmployeeComparePage.jsx";
import CompanySettings from "./pages/CompanySettings.jsx";
import CompanyInvitations from "./pages/CompanyInvitations.jsx";
import AcceptInvitation from "./pages/AcceptInvitation.jsx";

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/register" element={<SignupPage />} />
                    <Route path="/invite/:token" element={<AcceptInvitation />} />

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
                    <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                    <Route path="/insights" element={<ProtectedRoute><AIInsightsPage /></ProtectedRoute>} />
                    <Route path="/scorecards" element={<ProtectedRoute><ScorecardsPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                    <Route path="/company" element={<ProtectedRoute roles={["MANAGER", "ADMIN"]}><CompanyDashboard /></ProtectedRoute>} />
                    <Route path="/company/settings" element={<ProtectedRoute roles={["MANAGER", "ADMIN"]}><CompanySettings /></ProtectedRoute>} />
                    <Route path="/company/invitations" element={<ProtectedRoute roles={["MANAGER", "ADMIN"]}><CompanyInvitations /></ProtectedRoute>} />
                    <Route path="/company/employee/:userId" element={<ProtectedRoute roles={["MANAGER", "ADMIN"]}><EmployeePerformancePage /></ProtectedRoute>} />
                    <Route path="/company/compare/:userId" element={<ProtectedRoute roles={["MANAGER", "ADMIN"]}><EmployeeComparePage /></ProtectedRoute>} />
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
