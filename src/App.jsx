import './App.css'
import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import UploadForm from "./components/UploadForm";
import HistoryPage from "./pages/HistoryPage";
import CallDetailsPage from "./pages/CallDetailsPage";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={<LandingPage />}
                />
                <Route
                    path="/login"
                    element={<LoginPage />}
                />
                <Route
                    path="/signup"
                    element={<SignupPage />}
                />
                <Route
                    path="/register"
                    element={<SignupPage />}
                />
                <Route
                    path="/upload"
                    element={<UploadForm />}
                />

                <Route
                    path="/history"
                    element={<HistoryPage />}
                />

                <Route
                    path="/calls/:id"
                    element={<CallDetailsPage />}
                />
                <Route
                    path="/dashboard"
                    element={<DashboardPage />}
                />
            </Routes>

        </BrowserRouter>

    );
}

export default App;
