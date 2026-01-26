import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Forum as ForumIcon,
  Minimize as MinimizeIcon,
  PlaylistAddCheck as ProcessIcon
} from '@mui/icons-material';
import { datasetsService, workflowService, annotationsService } from '../services/ApiService';
import EncounterCard from '../components/UI/PatientsChart/EncounterCard';
import AnnotationModeDropdown from '../components/UI/Annotations/AnnotationModeDropdown';
import AnnotationDialog from '../components/UI/Annotations/AnnotationDialog';
import DiagnosisComponent from '../components/UI/SinglePatient/DiagnosisComponent';
import MedicationsComponent from '../components/UI/SinglePatient/MedicationsComponent';
import NotesComponent from '../components/UI/SinglePatient/NotesComponent';
import FlowsheetsComponent from '../components/UI/SinglePatient/FlowsheetsComponent';
import FlowsheetsInstanceComponent from '../components/UI/SinglePatient/FlowsheetsInstanceComponent';
import ResultsComponent from '../components/UI/SinglePatient/ResultsComponent';
import ProcessComponent from '../components/UI/Process/ProcessComponent';
import ChatComponent from '../components/UI/Chat/ChatComponent';
import BreadcrumbNav from '../components/UI/Common/BreadcrumbNav';
import { ProcessingProvider } from '../contexts/ProcessingContext';
import { useTheme } from '@mui/material/styles';

const SinglePatientPage = () => {
  const theme = useTheme();
  const { datasetName, mrn, projectName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { preselectedCSN, preselectedExperiment } = location.state || {};
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCSN, setSelectedCSN] = useState('');
  const [chatWidth, setChatWidth] = useState(400);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [workflowResults, setWorkflowResults] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState('process');
  const [patientExperiments, setPatientExperiments] = useState([]);

  // Annotation mode state
  const [annotationMode, setAnnotationMode] = useState(false);
  const [activeAnnotationGroup, setActiveAnnotationGroup] = useState(null);
  const [existingAnnotations, setExistingAnnotations] = useState(new Map());
  const [annotationDialogState, setAnnotationDialogState] = useState({
    open: false,
    item: null,
    itemId: null
  });

  // Decode dataset name for API calls
  const decodedDatasetName = datasetName ? decodeURIComponent(datasetName) : 'SickKids ICU';

  useEffect(() => {
    fetchPatientDetails();
  }, [mrn, datasetName]);

  useEffect(() => {
    if (patientData) {
      console.log('Patient data updated:', {
        hasSummary: !!patientData.summary,
        summaryEncounters: patientData.summary?.encounters?.length,
        actualEncounters: patientData.encounters?.length
      });
    }
  }, [patientData]);

  useEffect(() => {
    // Set encounter when patient data loads - prefer preselected CSN from navigation state
    if (patientData?.encounters?.length > 0 && !selectedCSN) {
      const initialCSN = preselectedCSN || patientData.encounters[0].csn.toString();
      setSelectedCSN(initialCSN);
    }
  }, [patientData, selectedCSN, preselectedCSN]);

  useEffect(() => {
    // Fetch patient experiments when CSN changes (only if viewing through project context)
    if (projectName && selectedCSN && patientData?.mrn) {
      fetchPatientExperiments();
    }
  }, [selectedCSN, patientData?.mrn, projectName]);

  useEffect(() => {
    // Exit annotation mode when patient changes
    if (annotationMode) {
      exitAnnotationMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrn]);

  useEffect(() => {
    // Listen for workflow completion events
    const handleWorkflowComplete = (event) => {
      if (event.detail && event.detail.type === 'workflow_complete') {
        setWorkflowResults(event.detail.results);
      }
    };

    window.addEventListener('workflowComplete', handleWorkflowComplete);
    return () => {
      window.removeEventListener('workflowComplete', handleWorkflowComplete);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        const constrainedWidth = Math.min(Math.max(newWidth, 300), window.innerWidth * 0.6);
        setChatWidth(constrainedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const toggleChatCollapse = () => {
    setChatCollapsed(prev => !prev);
  };

  const handleSidebarPanelChange = (panel) => {
    if (activeSidebarPanel === panel && !chatCollapsed) {
      setChatCollapsed(true);
    } else {
      setActiveSidebarPanel(panel);
      setChatCollapsed(false);
    }
  };

  const fetchPatientDetails = async () => {
    try {
      setLoading(true);
      const response = await datasetsService.getPatientDetails(decodedDatasetName, mrn);

      const data = response.data;
      setPatientData(data);
      console.log(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching patient details:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error occurred';
      setError(`Failed to load patient details: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientExperiments = async () => {
    try {
      if (projectName) {
        // Use project-scoped API when viewing through project context
        const response = await workflowService.getPatientExperimentsForProject(projectName, patientData.mrn);
        setPatientExperiments(response.data.experiments || []);
      } else {
        // Fallback (shouldn't happen since we only call this if projectName exists)
        setPatientExperiments([]);
      }
    } catch (err) {
      console.error('Error fetching patient experiments:', err);
      // Don't show error to user, just log it - experiments are optional
      setPatientExperiments([]);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };


  const handleGoBack = () => {
    if (projectName) {
      navigate(`/projects/${projectName}`);
    } else {
      const encodedDataset = encodeURIComponent(decodedDatasetName);
      navigate(`/datasets/${encodedDataset}/patients`);
    }
  };

  const handleCSNChange = (event) => {
    setSelectedCSN(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Annotation mode handlers
  const enterAnnotationMode = async (group) => {
    try {
      const response = await annotationsService.getGroupValues(projectName, group.id);
      const annotations = response.data.annotations || [];
      const map = new Map(annotations.map(a => [a.item_id, a]));
      setExistingAnnotations(map);
      setActiveAnnotationGroup(group);
      setAnnotationMode(true);
    } catch (err) {
      console.error('Error entering annotation mode:', err);
    }
  };

  const exitAnnotationMode = () => {
    setAnnotationMode(false);
    setActiveAnnotationGroup(null);
    setExistingAnnotations(new Map());
  };

  const openAnnotationDialog = (item, itemId) => {
    setAnnotationDialogState({ open: true, item, itemId: String(itemId) });
  };

  const closeAnnotationDialog = () => {
    setAnnotationDialogState({ open: false, item: null, itemId: null });
  };

  const saveAnnotation = async (values) => {
    const { itemId } = annotationDialogState;
    await annotationsService.saveAnnotation(
      projectName,
      activeAnnotationGroup.id,
      itemId,
      values
    );
    // Update local cache
    setExistingAnnotations(prev => {
      const next = new Map(prev);
      next.set(itemId, { item_id: itemId, values });
      return next;
    });
    closeAnnotationDialog();
  };

  const selectedEncounter = patientData?.encounters?.find(
    enc => enc.csn.toString() === selectedCSN
  );

  const getBreadcrumbs = () => {
    const breadcrumbs = [];

    if (projectName) {
      // Via projects path
      breadcrumbs.push({ label: 'Projects', path: '/projects' });
      breadcrumbs.push({ label: projectName, path: `/projects/${projectName}` });
      breadcrumbs.push({ label: decodedDatasetName });
      breadcrumbs.push({ label: `MRN: ${mrn}` });
    } else {
      // Via datasets path
      breadcrumbs.push({ label: 'Datasets', path: '/datasets' });
      const encodedDataset = encodeURIComponent(decodedDatasetName);
      breadcrumbs.push({ label: decodedDatasetName, path: `/datasets/${encodedDataset}/patients` });
      breadcrumbs.push({ label: `MRN: ${mrn}` });
    }

    return breadcrumbs;
  };

  const getEncounterSummary = (encounterCSN) => {
    if (!patientData?.summary?.encounters) {
      console.log('No summary encounters found in:', patientData?.summary);
      return null;
    }
    
    const summary = patientData.summary.encounters.find(
      enc => enc.csn.toString() === encounterCSN.toString()
    );
    
    if (!summary) {
      console.log('No summary found for CSN:', encounterCSN);
      console.log('Available summaries:', patientData.summary.encounters);
    }
    
    return summary;
  };

  // Function to reformat flowsheets pivot data to instance format
  const reformatFlowsheetsForAnalysis = (flowsheetsPivot) => {
    if (!flowsheetsPivot || !flowsheetsPivot.measurements) {
      return [];
    }

    // Collect all unique timestamps across all measurements
    const allTimestamps = new Set();
    flowsheetsPivot.measurements.forEach(measurement => {
      Object.keys(measurement.time_values || {}).forEach(timestamp => {
        allTimestamps.add(timestamp);
      });
    });

    // Sort timestamps chronologically
    const sortedTimestamps = Array.from(allTimestamps).sort();

    const flowsheetInstances = [];

    sortedTimestamps.forEach(timestamp => {
      const instance = {
        timestamp: timestamp,
        measurements: {}
      };

      // Collect measurements for this timestamp
      flowsheetsPivot.measurements.forEach(measurement => {
        const timeValues = measurement.time_values || {};
        if (timeValues[timestamp]) {
          const measName = measurement.flo_meas_name || '';
          const measurementKey = measName.toLowerCase().replace(' ', '_');

          instance.measurements[measurementKey] = {
            flo_meas_id: measurement.flo_meas_id,
            flo_meas_name: measName,
            disp_name: measurement.disp_name,
            value: timeValues[timestamp].value,
            comment: timeValues[timestamp].comment
          };
        }
      });

      flowsheetInstances.push(instance);
    });

    return flowsheetInstances;
  };

  if (loading) {
    return (
      <ProcessingProvider>
        <Box sx={{ 
          display: 'flex', 
          height: 'calc(100vh - 80px)', // Subtract navbar height
          overflow: 'hidden',
          background: theme.pageGradient
        }}>
          {/* Main Content - Left Side */}
          <Box sx={{ 
            flex: 1,
            height: 'calc(100vh - 80px)', // Subtract navbar height
            overflowY: 'auto',
            padding: 4
          }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={60} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Loading patient details...
              </Typography>
            </Box>
          </Box>
          
          {/* Sidebar with Chat - Right Side */}
          <Box sx={{ 
            width: `${chatCollapsed ? 60 : chatWidth + 60}px`,
            height: 'calc(100vh - 80px)', // Subtract navbar height
            display: 'flex',
            transition: 'width 0.3s ease'
          }}>
            {/* Chat Panel */}
            <Box sx={{ 
              width: `${chatCollapsed ? 0 : chatWidth}px`,
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
              transition: 'width 0.3s ease'
            }}>
              <ChatComponent collapsed={chatCollapsed} onToggleCollapse={toggleChatCollapse} />
            </Box>
            
            {/* Permanent Thin Sidebar */}
            <Box sx={{ 
              width: '60px',
              backgroundColor: 'surface.main',
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 2,
              gap: 1
            }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  padding: 1,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'surface.tab'
                  }
                }}
              >
                <ProcessIcon 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: 24 
                  }} 
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}
                >
                  Process
                </Typography>
              </Box>
              
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  padding: 1,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'surface.tab'
                  }
                }}
                onClick={toggleChatCollapse}
              >
                <ForumIcon
                  sx={{
                    color: chatCollapsed ? 'text.secondary' : 'icon.main',
                    fontSize: 24
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    color: chatCollapsed ? 'text.secondary' : 'icon.main'
                  }}
                >
                  Chat
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </ProcessingProvider>
    );
  }

  if (error) {
    return (
      <ProcessingProvider>
        <Box sx={{ 
          display: 'flex', 
          height: 'calc(100vh - 80px)', // Subtract navbar height
          overflow: 'hidden',
          background: theme.pageGradient
        }}>
          {/* Main Content - Left Side */}
          <Box sx={{ 
            flex: 1,
            height: 'calc(100vh - 80px)', // Subtract navbar height
            overflowY: 'auto',
            padding: 4
          }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleGoBack}
              sx={{ mb: 2 }}
            >
              Back to Patients
            </Button>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          </Box>
          
          {/* Sidebar with Chat - Right Side */}
          <Box sx={{ 
            width: `${chatCollapsed ? 60 : chatWidth + 60}px`,
            height: 'calc(100vh - 80px)', // Subtract navbar height
            display: 'flex',
            transition: 'width 0.3s ease'
          }}>
            {/* Chat Panel */}
            <Box sx={{ 
              width: `${chatCollapsed ? 0 : chatWidth}px`,
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
              transition: 'width 0.3s ease'
            }}>
              <ChatComponent collapsed={chatCollapsed} onToggleCollapse={toggleChatCollapse} />
            </Box>
            
            {/* Permanent Thin Sidebar */}
            <Box sx={{ 
              width: '60px',
              backgroundColor: 'surface.main',
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 2,
              gap: 1
            }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  padding: 1,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'surface.tab'
                  }
                }}
              >
                <ProcessIcon 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: 24 
                  }} 
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    color: 'text.secondary'
                  }}
                >
                  Process
                </Typography>
              </Box>
              
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  padding: 1,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'surface.tab'
                  }
                }}
                onClick={toggleChatCollapse}
              >
                <ForumIcon
                  sx={{
                    color: chatCollapsed ? 'text.secondary' : 'icon.main',
                    fontSize: 24
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    color: chatCollapsed ? 'text.secondary' : 'icon.main'
                  }}
                >
                  Chat
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </ProcessingProvider>
    );
  }

  return (
    <ProcessingProvider>
      <Box sx={{ 
        display: 'flex', 
        height: 'calc(100vh - 80px)', // Subtract navbar height
        overflow: 'hidden',
        position: 'relative',
        userSelect: isResizing ? 'none' : 'auto',
        background: theme.pageGradient
      }}>
        {/* Main Content - Left Side */}
        <Box sx={{ 
          flex: 1,
          height: 'calc(100vh - 80px)', // Subtract navbar height
          overflowY: 'auto',
          padding: 4
        }}>
          {/* Breadcrumbs */}
          <BreadcrumbNav breadcrumbs={getBreadcrumbs()} />

          {/* Header */}
          <Box sx={{ mb: 3 }}>
            {/* Patient Information & Encounter Selection Card */}
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              {/* Patient Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PersonIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h4" component="h1">
                      Patient MRN: {patientData?.mrn}
                    </Typography>
                  </Box>
                </Box>
                {/* Annotation Mode - Only show when viewing through project context */}
                {projectName && (
                  <AnnotationModeDropdown
                    projectName={projectName}
                    activeGroup={activeAnnotationGroup}
                    onSelectGroup={enterAnnotationMode}
                    onExit={exitAnnotationMode}
                  />
                )}
              </Box>

              {/* Patient Demographics */}
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body1">
                    <strong>Sex:</strong> {patientData?.sex || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body1">
                    <strong>Date of Birth:</strong> {formatDate(patientData?.date_of_birth)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body1">
                    <strong>Total Encounters:</strong> {patientData?.encounters?.length || 0}
                  </Typography>
                </Grid>
              </Grid>

              {/* Encounter Selection Section */}
              <Box>
                
                <FormControl component="fieldset" sx={{ width: '100%' }}>
                  <FormLabel component="legend" sx={{ mb: 2 }}>
                    Available Encounters:
                  </FormLabel>
                  <RadioGroup
                    value={selectedCSN}
                    onChange={handleCSNChange}
                    sx={{ gap: 2 }}
                  >
                    {patientData?.encounters?.map((encounter) => {
                      console.log('Rendering encounter:', encounter.csn);
                      const encounterSummary = getEncounterSummary(encounter.csn);
                      return (
                        <FormControlLabel
                          key={encounter.csn}
                          value={encounter.csn.toString()}
                          control={<Radio />}
                          label={
                            <Box sx={{ ml: 1, width: '100%', flex: 1 }}>
                              <EncounterCard
                                encounter={encounter}
                                metrics={encounterSummary?.metrics}
                                patientMrn={patientData.mrn}
                                hideViewButton={true}
                                annotationMode={annotationMode && activeAnnotationGroup?.source === 'encounter'}
                                isAnnotated={existingAnnotations.has(String(encounter.csn))}
                                onAnnotateClick={() => openAnnotationDialog(encounter, encounter.csn)}
                              />
                            </Box>
                          }
                          sx={{ 
                            alignItems: 'flex-start',
                            margin: 0,
                            width: '100%',
                            '& .MuiFormControlLabel-label': {
                              width: '100%'
                            }
                          }}
                        />
                      );
                    })}
                  </RadioGroup>
                </FormControl>
              </Box>
            </Paper>
          </Box>

          {/* Data Components - Tabbed View */}
          {selectedEncounter && (
            <Paper elevation={2} sx={{ mb: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                  {projectName && <Tab label="Workflow Results" />}
                  <Tab label="Notes" />
                  <Tab label="Medications" />
                  <Tab label="Flowsheets" />
                  <Tab label="Diagnoses" />
                </Tabs>
              </Box>

              <Box sx={{ p: 2 }}>
                {/* Workflow Results Tab (only shown when viewing through project) */}
                {projectName && activeTab === 0 && (
                  <ResultsComponent
                    workflowResults={workflowResults}
                    mrn={patientData?.mrn}
                    csn={selectedCSN}
                    patientExperiments={patientExperiments}
                    initialExperiment={preselectedExperiment}
                  />
                )}

                {/* Notes Tab */}
                {activeTab === (projectName ? 1 : 0) && (
                  <NotesComponent
                    notes={selectedEncounter?.notes || []}
                    mrn={patientData?.mrn}
                    csn={selectedCSN}
                    annotationMode={annotationMode && activeAnnotationGroup?.source === 'note'}
                    annotationMap={existingAnnotations}
                    onAnnotateClick={(note) => openAnnotationDialog(note, note.note_id)}
                  />
                )}

                {/* Medications Tab */}
                {activeTab === (projectName ? 2 : 1) && (
                  <MedicationsComponent
                    medications={selectedEncounter?.medications || []}
                    mrn={patientData?.mrn}
                    csn={selectedCSN}
                    annotationMode={annotationMode && activeAnnotationGroup?.source === 'medication'}
                    annotationMap={existingAnnotations}
                    onAnnotateClick={(med) => openAnnotationDialog(med, med.order_id)}
                  />
                )}

                {/* Flowsheets Tab */}
                {activeTab === (projectName ? 3 : 2) && (
                  <FlowsheetsInstanceComponent
                    flowsheet_instances={reformatFlowsheetsForAnalysis(selectedEncounter?.flowsheets_pivot)}
                    mrn={patientData?.mrn}
                    csn={selectedCSN}
                  />
                )}

                {/* Diagnoses Tab */}
                {activeTab === (projectName ? 4 : 3) && (
                  <DiagnosisComponent
                    diagnoses={selectedEncounter?.diagnoses || []}
                    mrn={patientData?.mrn}
                    csn={selectedCSN}
                    annotationMode={annotationMode && activeAnnotationGroup?.source === 'diagnosis'}
                    annotationMap={existingAnnotations}
                    onAnnotateClick={(diag) => openAnnotationDialog(diag, diag.diagnosis_id)}
                  />
                )}
              </Box>
            </Paper>
          )}

          {!selectedEncounter && selectedCSN && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No data found for the selected encounter.
            </Alert>
          )}
        </Box>
        
        {/* Resize Handle */}
        {!chatCollapsed && (
          <Box
            sx={{
              position: 'absolute',
              right: `${chatWidth + 60}px`, // Account for the 60px sidebar
              top: 0,
              bottom: 0,
              width: '4px',
              backgroundColor: 'transparent',
              cursor: 'col-resize',
              '&:hover': {
                backgroundColor: 'primary.main',
                opacity: 0.2,
              },
              '&:active': {
                backgroundColor: 'primary.main',
                opacity: 0.4,
              }
            }}
            onMouseDown={handleResizeStart}
          />
        )}
        
        {/* Sidebar with Chat - Right Side */}
        <Box sx={{ 
          width: `${chatCollapsed ? 60 : chatWidth + 60}px`,
          height: 'calc(100vh - 80px)', // Subtract navbar height
          display: 'flex',
          transition: 'width 0.3s ease'
        }}>
          {/* Panel Content */}
          <Box sx={{ 
            width: `${chatCollapsed ? 0 : chatWidth}px`,
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
            transition: 'width 0.3s ease'
          }}>
            {activeSidebarPanel === 'chat' && (
              <ChatComponent 
                mrn={patientData?.mrn} 
                csn={selectedCSN}
                collapsed={chatCollapsed}
                onToggleCollapse={toggleChatCollapse}
              />
            )}
            {activeSidebarPanel === 'process' && (
              <ProcessComponent
                mrn={patientData?.mrn}
                csn={selectedCSN}
                patientExperiments={patientExperiments}
              />
            )}
          </Box>
          
          {/* Permanent Thin Sidebar */}
          <Box sx={{ 
            width: '60px',
            backgroundColor: 'surface.main',
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 2,
            gap: 1
          }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                padding: 1,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'surface.tab'
                }
              }}
              onClick={() => handleSidebarPanelChange('process')}
            >
              <ProcessIcon
                sx={{
                  color: activeSidebarPanel === 'process' && !chatCollapsed ? 'icon.main' : 'text.secondary',
                  fontSize: 24
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  color: activeSidebarPanel === 'process' && !chatCollapsed ? 'icon.main' : 'text.secondary'
                }}
              >
                Process
              </Typography>
            </Box>
            
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                padding: 1,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'surface.tab'
                }
              }}
              onClick={() => handleSidebarPanelChange('chat')}
            >
              <ForumIcon
                sx={{
                  color: activeSidebarPanel === 'chat' && !chatCollapsed ? 'icon.main' : 'text.secondary',
                  fontSize: 24
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 500,
                  color: activeSidebarPanel === 'chat' && !chatCollapsed ? 'icon.main' : 'text.secondary'
                }}
              >
                Chat
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Annotation Dialog */}
      <AnnotationDialog
        open={annotationDialogState.open}
        onClose={closeAnnotationDialog}
        item={annotationDialogState.item}
        sourceType={activeAnnotationGroup?.source}
        group={activeAnnotationGroup}
        existingValues={existingAnnotations.get(annotationDialogState.itemId)}
        onSave={saveAnnotation}
      />
    </ProcessingProvider>
  );
};

export default SinglePatientPage;
