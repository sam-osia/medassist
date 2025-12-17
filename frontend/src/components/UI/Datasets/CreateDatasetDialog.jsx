import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Box,
  Typography,
  Divider,
  InputLabel,
  FormControl
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

const CreateDatasetDialog = ({ open, onClose, onDatasetCreated }) => {
  // Section 1: Cohort state
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [sexMale, setSexMale] = useState(false);
  const [sexFemale, setSexFemale] = useState(false);
  const [encounterType, setEncounterType] = useState('');

  // Section 2: Variables state
  const [demographics, setDemographics] = useState('');
  const [encounters, setEncounters] = useState('');
  const [diagnoses, setDiagnoses] = useState('');
  const [labs, setLabs] = useState('');
  const [vitals, setVitals] = useState('');
  const [medications, setMedications] = useState('');

  // Section 3: Privacy state
  const [removeDirectId, setRemoveDirectId] = useState(false);
  const [removeDob, setRemoveDob] = useState(false);
  const [dateShiftEncounters, setDateShiftEncounters] = useState(false);
  const [topCodeAge, setTopCodeAge] = useState(false);
  const [dateShift, setDateShift] = useState(false);

  const handleClose = () => {
    onClose();
  };

  const handleCreate = () => {
    const formData = {
      cohort: {
        startDate,
        endDate,
        ageMin,
        ageMax,
        sex: { male: sexMale, female: sexFemale },
        encounterType
      },
      variables: {
        demographics,
        encounters,
        diagnoses,
        labs,
        vitals,
        medications
      },
      privacy: {
        removeDirectId,
        removeDob,
        dateShiftEncounters,
        topCodeAge,
        dateShift
      }
    };
    console.log('Dataset creation data:', formData);
    handleClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Dataset</DialogTitle>
        <DialogContent>
          {/* Section 1: Cohort */}
          <Box sx={{ mb: 4, mt: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Cohort
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'surface.main', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DateTimePicker
                    label="Start Date"
                    value={startDate}
                    onChange={setStartDate}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DateTimePicker
                    label="End Date"
                    value={endDate}
                    onChange={setEndDate}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Age (Min)"
                    type="number"
                    fullWidth
                    value={ageMin}
                    onChange={(e) => setAgeMin(e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Age (Max)"
                    type="number"
                    fullWidth
                    value={ageMax}
                    onChange={(e) => setAgeMax(e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid size={12}>
                  <FormLabel component="legend">Sex</FormLabel>
                  <FormGroup row>
                    <FormControlLabel
                      control={<Checkbox checked={sexMale} onChange={(e) => setSexMale(e.target.checked)} />}
                      label="Male"
                    />
                    <FormControlLabel
                      control={<Checkbox checked={sexFemale} onChange={(e) => setSexFemale(e.target.checked)} />}
                      label="Female"
                    />
                  </FormGroup>
                </Grid>
                <Grid size={12}>
                  <FormControl fullWidth>
                    <InputLabel>Encounter Type</InputLabel>
                    <Select
                      value={encounterType}
                      label="Encounter Type"
                      onChange={(e) => setEncounterType(e.target.value)}
                    >
                      <MenuItem value="inpatient">Inpatient</MenuItem>
                      <MenuItem value="emergency">Emergency</MenuItem>
                      <MenuItem value="outpatient">Outpatient</MenuItem>
                      <MenuItem value="observation">Observation</MenuItem>
                      <MenuItem value="telehealth">Telehealth</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Section 2: Variables */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Variables
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'surface.main', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={12}>
                  <TextField
                    label="Demographics"
                    fullWidth
                    value={demographics}
                    onChange={(e) => setDemographics(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="Encounters"
                    fullWidth
                    value={encounters}
                    onChange={(e) => setEncounters(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="Diagnoses"
                    fullWidth
                    value={diagnoses}
                    onChange={(e) => setDiagnoses(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="Labs"
                    fullWidth
                    value={labs}
                    onChange={(e) => setLabs(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="Vitals"
                    fullWidth
                    value={vitals}
                    onChange={(e) => setVitals(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label="Medications"
                    fullWidth
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Section 3: Privacy and De-identification */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Privacy and De-identification
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'surface.main', borderRadius: 1 }}>
              <FormGroup>
                <FormControlLabel
                  control={<Checkbox checked={removeDirectId} onChange={(e) => setRemoveDirectId(e.target.checked)} />}
                  label="Remove Direct ID"
                />
                <FormControlLabel
                  control={<Checkbox checked={removeDob} onChange={(e) => setRemoveDob(e.target.checked)} />}
                  label="Remove DOB"
                />
                <FormControlLabel
                  control={<Checkbox checked={dateShiftEncounters} onChange={(e) => setDateShiftEncounters(e.target.checked)} />}
                  label="Date Shift Encounters"
                />
                <FormControlLabel
                  control={<Checkbox checked={topCodeAge} onChange={(e) => setTopCodeAge(e.target.checked)} />}
                  label="Top Code Age"
                />
                <FormControlLabel
                  control={<Checkbox checked={dateShift} onChange={(e) => setDateShift(e.target.checked)} />}
                  label="Date Shift"
                />
              </FormGroup>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
          >
            Create Dataset
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default CreateDatasetDialog;