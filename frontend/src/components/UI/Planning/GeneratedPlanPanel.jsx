import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Button
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import StepComponent from './StepComponent';

const GeneratedPlanPanel = ({
  result,
  updatingPlan,
  prompt,
  onPlanUpdate,
  onLoadingChange,
  onStepEdit,
  onPromptEdit,
  allowStepEditing = true,
  onSavePlan,
  selectedPlanName,
  awaitingResponse,
  loading
}) => {
  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' }}>
      <Card sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '100%' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 1 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            📋 {updatingPlan ? 'Updating Plan...' : 'Generated Plan'}
          </Typography>
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            position: 'relative',
            pr: 1,
            minHeight: 0
          }}>
            {result?.raw_plan?.steps ? (
              result.raw_plan.steps.map((step, index) => (
                <StepComponent
                  key={step.id || index}
                  step={step}
                  stepNumber={index + 1}
                  originalPrompt={prompt}
                  originalPlan={result.raw_plan}
                  onPlanUpdate={onPlanUpdate}
                  onLoadingChange={onLoadingChange}
                  onStepEdit={onStepEdit}
                  onPromptEdit={onPromptEdit}
                  allowStepEditing={allowStepEditing}
                />
              ))
            ) : result ? (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontStyle: 'italic',
                    opacity: 0.6
                  }}
                >
                  Plan has no steps to display
                </Typography>
              </Box>
            ) : (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontStyle: 'italic',
                    opacity: 0.6
                  }}
                >
                  Prompt the planning agent to generate a plan
                </Typography>
              </Box>
            )}
          </Box>

          {/* Save Plan Button */}
          {result && !awaitingResponse && !selectedPlanName && (
            <Box sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider'
            }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={onSavePlan}
                disabled={loading}
                sx={{ minWidth: 140 }}
              >
                Save Plan
              </Button>
            </Box>
          )}

          {/* Updating overlay */}
          {updatingPlan && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'background.paper',
                opacity: 0.8,
                backdropFilter: 'blur(2px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: 1,
                zIndex: 10
              }}
            >
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                Updating Plan
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default GeneratedPlanPanel;
