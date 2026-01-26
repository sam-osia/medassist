import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import PatientsChartPage from './pages/PatientsChartPage';
import SinglePatientPage from './pages/SinglePatientPage';
import PlanningAgentPage from './pages/PlanningAgentPage';
import ToolkitPlaygroundPage from './pages/ToolkitPlaygroundPage';
import ProjectsPage from './pages/ProjectsPage';
import IndividualProjectPage from './pages/IndividualProjectPage';
import DatasetsPage from './pages/DatasetsPage';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import CaboodlePage from './pages/CaboodlePage';
import DashboardPage from './pages/DashboardPage';
import Navbar from './components/UI/Common/Navbar';
import { theme, themeDark, pageGradient, getPageGradient } from './themes/sickkids';
import './App.css';

// Re-export for backward compatibility
export { pageGradient, getPageGradient };

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Admin Protected Route Component
const AdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppContent() {
  const { themeMode } = useThemeMode();
  const currentTheme = themeMode === 'dark' ? themeDark : theme;

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><Navigate to="/datasets" replace /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><><Navbar /><DashboardPage /></></ProtectedRoute>} />
            <Route path="/datasets" element={<ProtectedRoute><><Navbar /><DatasetsPage /></></ProtectedRoute>} />
            <Route path="/datasets/:datasetName/patients" element={<ProtectedRoute><><Navbar /><PatientsChartPage /></></ProtectedRoute>} />
            <Route path="/datasets/:datasetName/patient/:mrn" element={<ProtectedRoute><><Navbar /><SinglePatientPage /></></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><><Navbar /><ProjectsPage /></></ProtectedRoute>} />
            <Route path="/projects/:projectName" element={<ProtectedRoute><><Navbar /><IndividualProjectPage /></></ProtectedRoute>} />
            <Route path="/projects/:projectName/dataset/:datasetName/patient/:mrn" element={<ProtectedRoute><><Navbar /><SinglePatientPage /></></ProtectedRoute>} />
            <Route path="/planning-agent" element={<ProtectedRoute><><Navbar /><PlanningAgentPage /></></ProtectedRoute>} />
            <Route path="/tool-playground" element={<ProtectedRoute><><Navbar /><ToolkitPlaygroundPage /></></ProtectedRoute>} />
            <Route path="/caboodle" element={<ProtectedRoute><><Navbar /><CaboodlePage /></></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><><Navbar /><AccountPage /></></ProtectedRoute>} />
            <Route path="/admin" element={<AdminProtectedRoute><><Navbar /><AdminDashboardPage /></></AdminProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><Navigate to="/datasets" replace /></ProtectedRoute>} />
            <Route path="*" element={<ProtectedRoute><Navigate to="/datasets" replace /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  useEffect(() => {
    document.title = 'MedAssist - UHN DATA';
    document.querySelector('link[rel="icon"]').href = '/data-favicon-no-background.png';
  }, []);

  return (
    <ThemeModeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeModeProvider>
  );
}

export default App;
