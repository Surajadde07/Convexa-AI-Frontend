/**
 * App.jsx
 *
 * Wrap routes in ThemeProvider, BrowserRouter, and WorkspaceProvider.
 * Support workspace-scoped routes (/w/:companySlug/...) as well as flat routes
 * (which automatically redirect to the scoped version via ProtectedRoute).
 */

import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";

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
import WorkspaceMembers from "./pages/WorkspaceMembers.jsx";
import NoWorkspace from "./pages/NoWorkspace.jsx";
import RevenueIntelligencePage from "./pages/RevenueIntelligencePage.jsx";
import BillingSeatsPage from "./pages/BillingSeatsPage.jsx";

function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <WorkspaceProvider>
                    <Routes>
                        {/* Public routes */}
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignupPage />} />
                        <Route path="/register" element={<SignupPage />} />
                        <Route path="/invite/:token" element={<AcceptInvitation />} />
                        {/* Company-First (Model A): shown when user authenticated but has no workspace */}
                        <Route path="/no-workspace" element={<NoWorkspace />} />

                        {/* Flat protected routes — will redirect to workspace-scoped versions */}
                        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                        <Route path="/calls/:id" element={<ProtectedRoute><CallDetailsPage /></ProtectedRoute>} />
                        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                        <Route path="/upload" element={<ProtectedRoute><UploadForm /></ProtectedRoute>} />
                        <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                        <Route path="/reports" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                        <Route path="/revenue-intelligence" element={<ProtectedRoute roles={["OWNER"]}><RevenueIntelligencePage /></ProtectedRoute>} />
                        <Route path="/insights" element={<ProtectedRoute><AIInsightsPage /></ProtectedRoute>} />
                        <Route path="/scorecards" element={<ProtectedRoute><ScorecardsPage /></ProtectedRoute>} />
                        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                        <Route path="/company" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><CompanyDashboard /></ProtectedRoute>} />
                        <Route path="/company/members" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><WorkspaceMembers /></ProtectedRoute>} />
                        <Route path="/company/billing" element={<ProtectedRoute roles={["OWNER"]}><BillingSeatsPage /></ProtectedRoute>} />
                        <Route path="/company/settings" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><CompanySettings /></ProtectedRoute>} />
                        <Route path="/company/invitations" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><CompanyInvitations /></ProtectedRoute>} />
                        <Route path="/company/employee/:userId" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><EmployeePerformancePage /></ProtectedRoute>} />
                        <Route path="/company/compare/:userId" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><EmployeeComparePage /></ProtectedRoute>} />

                        {/* Workspace-scoped protected routes */}
                        <Route path="/w/:companySlug/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/calls/:id" element={<ProtectedRoute><CallDetailsPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/upload" element={<ProtectedRoute><UploadForm /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/reports" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/revenue-intelligence" element={<ProtectedRoute roles={["OWNER"]}><RevenueIntelligencePage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/insights" element={<ProtectedRoute><AIInsightsPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/scorecards" element={<ProtectedRoute><ScorecardsPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><CompanyDashboard /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company/members" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><WorkspaceMembers /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company/billing" element={<ProtectedRoute roles={["OWNER"]}><BillingSeatsPage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company/settings" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><CompanySettings /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company/invitations" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><CompanyInvitations /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company/employee/:userId" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><EmployeePerformancePage /></ProtectedRoute>} />
                        <Route path="/w/:companySlug/company/compare/:userId" element={<ProtectedRoute roles={["OWNER", "MANAGER", "ADMIN"]}><EmployeeComparePage /></ProtectedRoute>} />
                    </Routes>
                </WorkspaceProvider>
            </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
