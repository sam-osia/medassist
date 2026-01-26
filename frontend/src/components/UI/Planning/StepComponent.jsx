import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Divider,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Build as ToolIcon,
  ForkLeft as IfIcon,
  Loop as LoopIcon,
  Flag as FlagIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { planningService } from '../../../services/ApiService';
import { getStepDisplayConfig } from './StepDisplayConfig';
import PromptDialog from '../Prompt/PromptDialog';

const getStepConfig = (theme) => ({
  tool: {
    icon: <ToolIcon />,
    color: theme.palette.primary.main,
    bgColor: theme.palette.primary.light || '#e3f2fd',
    label: 'Tool'
  },
  if: {
    icon: <IfIcon />,
    color: theme.palette.primary.main,
    bgColor: theme.palette.primary.light || '#e3f2fd',
    label: 'Conditional'
  },
  loop: {
    icon: <LoopIcon />,
    color: theme.palette.primary.main,
    bgColor: theme.palette.primary.light || '#e3f2fd',
    label: 'Loop'
  },
  flag_variable: {
    icon: <FlagIcon />,
    color: theme.palette.primary.main,
    bgColor: theme.palette.primary.light || '#e3f2fd',
    label: 'Flag'
  }
});

const formatCondition = (condition) => {
  if (typeof condition === 'string') {
    return condition;
  }
  
  if (condition?.type === 'expression') {
    return condition.expression;
  }
  
  if (condition?.type === 'comparison') {
    return `${condition.left} ${condition.operator} ${condition.right}`;
  }
  
  if (condition?.type === 'logical') {
    const subConditions = condition.conditions?.map(formatCondition) || [];
    return subConditions.join(` ${condition.operator} `);
  }
  
  return JSON.stringify(condition);
};

// Tool parameter importance mapping for smart display
const getKeyParameters = (toolName, inputs) => {
  const toolParameterMap = {
    'get_patient_notes_ids': ['mrn'],
    'read_patient_note': ['note_id'],
    'summarize_patient_note': ['note_id', 'focus'],
    'highlight_patient_note': ['note_id', 'focus'],
    'store_note_result': ['note_id', 'result_type'],
    'read_flowsheets_table': ['mrn', 'table_name'],
    'summarize_flowsheets_table': ['table_data'],
    'get_medications_ids': ['mrn'],
    'read_medication': ['medication_id'],
    'get_diagnosis_ids': ['mrn'],
    'read_diagnosis': ['diagnosis_id']
  };
  
  const keyParams = toolParameterMap[toolName] || [];
  const inputObj = typeof inputs === 'object' ? inputs : {};
  
  return keyParams
    .map(param => ({ key: param, value: inputObj[param] }))
    .filter(item => item.value !== undefined);
};

// Primary step information component
const StepPrimary = ({ step, stepNumber, originalPrompt, originalPlan, onPlanUpdate, onLoadingChange, onStepEdit, expanded, onToggleExpand, allowStepEditing = true }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(step.step_summary || '');
  const [isLoading, setIsLoading] = useState(false);
  const theme = useTheme();

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(step.step_summary || '');
  };

  const handleSubmitEdit = async () => {
    if (editValue === step.step_summary) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    if (onLoadingChange) {
      onLoadingChange(true);
    }

    // Pass the edit request to parent instead of calling API directly
    if (onStepEdit) {
      await onStepEdit(step.id, step.step_summary, editValue);
    }

    setIsLoading(false);
    setIsEditing(false);
    if (onLoadingChange) {
      onLoadingChange(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmitEdit();
    } else if (e.key === 'Escape') {
      setEditValue(step.step_summary || '');
      setIsEditing(false);
    }
  };

  const STEP_CONFIG = getStepConfig(theme);
  const config = STEP_CONFIG[step.type] || STEP_CONFIG.tool;

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexShrink: 0,
          gap: 1
        }}>
          {stepNumber && (
            <Chip
              label={stepNumber}
              size="small"
              sx={{
                height: 20,
                minWidth: 20,
                backgroundColor: config.color,
                color: 'white',
                fontWeight: 600,
                fontSize: '0.7rem',
                '& .MuiChip-label': {
                  px: 0.5
                }
              }}
            />
          )}
          <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>
            {config.icon}
          </Box>
        </Box>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSubmitEdit}
          onKeyDown={handleKeyPress}
          autoFocus
          disabled={isLoading}
          variant="outlined"
          sx={{
            '& .MuiInputBase-root': {
              fontSize: '1rem',
              fontWeight: 600,
              backgroundColor: 'background.paper'
            },
            flex: 1
          }}
        />
        {isLoading && <CircularProgress size={16} />}
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: { xs: 'flex-start', sm: 'center' }, 
      gap: { xs: 1.5, sm: 2 }, 
      width: '100%',
      minHeight: 32
    }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        flexShrink: 0,
        gap: 1,
        mt: { xs: 0.25, sm: 0 }
      }}>
        {stepNumber && (
          <Chip
            label={stepNumber}
            size="small"
            sx={{
              height: 20,
              minWidth: 20,
              backgroundColor: config.color,
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              '& .MuiChip-label': {
                px: 0.5
              }
            }}
          />
        )}
        <Box sx={{ color: config.color, display: 'flex', alignItems: 'center' }}>
          {config.icon}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography 
          variant="body1" 
          sx={{ 
            fontWeight: 600,
            fontSize: { xs: '0.95rem', sm: '1rem' },
            lineHeight: 1.4,
            wordBreak: 'break-word',
            color: 'text.primary',
            letterSpacing: '-0.01em',
            flex: 1
          }}
        >
          {step.step_summary}
        </Typography>
        {allowStepEditing && (
          <IconButton
            size="small"
            onClick={handleStartEdit}
            sx={{
              opacity: 0.5,
              p: 0.5,
              '&:hover': {
                opacity: 1,
                backgroundColor: 'action.hover'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        <IconButton
          size="small"
          onClick={onToggleExpand}
          sx={{ 
            opacity: 0.6,
            p: 0.5,
            '&:hover': { 
              opacity: 1,
              backgroundColor: 'action.hover'
            },
            transition: 'all 0.2s ease-in-out'
          }}
        >
          {expanded ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  );
};

// Secondary step information component
const StepSecondary = ({ step }) => {
  const renderSecondaryInfo = () => {
    switch (step.type) {
      case 'tool':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1 }, 
            flexWrap: 'wrap',
            mt: 0.5
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500, 
                fontSize: '0.875rem',
                color: 'text.secondary',
                backgroundColor: 'action.hover',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontFamily: 'monospace'
              }}
            >
              {step.tool}
            </Typography>
          </Box>
        );
      
      case 'if':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1 }, 
            flexWrap: 'wrap',
            mt: 0.5
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500, 
                fontSize: '0.875rem',
                color: 'text.secondary',
                backgroundColor: 'action.hover',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontFamily: 'monospace'
              }}
            >
              if {formatCondition(step.condition)}
            </Typography>
          </Box>
        );
      
      case 'loop':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1 }, 
            flexWrap: 'wrap',
            mt: 0.5
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500, 
                fontSize: '0.875rem',
                color: 'text.secondary',
                backgroundColor: 'action.hover',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontFamily: 'monospace'
              }}
            >
              for {step.for_var || step.for} in {step.in_expr || step.in}
            </Typography>
          </Box>
        );
      
      case 'flag_variable':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 0.5, sm: 1 }, 
            flexWrap: 'wrap',
            mt: 0.5
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500, 
                fontSize: '0.875rem',
                color: 'text.secondary',
                backgroundColor: 'action.hover',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontFamily: 'monospace'
              }}
            >
              {step.variable} = {String(step.value)}
            </Typography>
          </Box>
        );
      
      default:
        return null;
    }
  };

  const secondaryInfo = renderSecondaryInfo();
  if (!secondaryInfo) return null;

  return (
    <Box sx={{ 
      ml: { xs: 2.5, sm: 3 }, 
      mb: 0.5,
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {secondaryInfo}
    </Box>
  );
};


// Tertiary step information component (expandable details)
const StepTertiary = ({ step, expanded, onPromptEdit }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [viewingPromptValue, setViewingPromptValue] = useState(null);
  const [viewingPromptVariables, setViewingPromptVariables] = useState([]);

  const handleOpenDialog = (fieldName, fieldValue) => {
    setDialogData({ fieldName, fieldValue });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDialogData(null);
  };

  const handleOpenPromptDialog = (promptValue) => {
    // Extract available variables from step inputs (all keys except 'prompt')
    const variables = Object.keys(step.inputs || {}).filter(key => key !== 'prompt');
    setViewingPromptValue(promptValue);
    setViewingPromptVariables(variables);
    setPromptDialogOpen(true);
  };

  const handleClosePromptDialog = () => {
    setPromptDialogOpen(false);
    setViewingPromptValue(null);
    setViewingPromptVariables([]);
  };

  const handleSavePrompt = async (newPromptValue) => {
    if (onPromptEdit) {
      await onPromptEdit(step.id, newPromptValue);
    }
  };

  const renderAllInputs = (inputs, toolName) => {
    if (!inputs) return null;

    const inputObj = typeof inputs === 'object' ? inputs : {};
    const entries = Object.entries(inputObj);

    if (entries.length === 0) return null;

    return (
      <Box sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          Inputs:
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, listStyle: 'none' }}>
          {entries.map(([key, value]) => {
            const displayConfig = getStepDisplayConfig(toolName, key, value);

            return (
              <Box component="li" key={key} sx={{ mb: 0.5 }}>
                {displayConfig.display === 'badge' ? (
                  // Badge display: highlighted chip
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        fontFamily: 'monospace'
                      }}
                    >
                      • {key}:
                    </Typography>
                    <Chip
                      label={String(value)}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.7rem',
                        fontFamily: 'monospace'
                      }}
                    />
                  </Box>
                ) : displayConfig.display === 'link' ? (
                  // Link display: clickable text
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        fontFamily: 'monospace'
                      }}
                    >
                      • {key}:
                    </Typography>
                    <Typography
                      variant="body2"
                      onClick={() => handleOpenDialog(key, value)}
                      sx={{
                        fontSize: '0.75rem',
                        color: 'primary.main',
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        '&:hover': {
                          color: 'primary.dark'
                        }
                      }}
                    >
                      {String(value)}
                    </Typography>
                  </Box>
                ) : displayConfig.display === 'truncated' ? (
                  // Truncated display: with show more toggle
                  <TruncatedText
                    fieldName={key}
                    value={value}
                    maxLength={displayConfig.maxLength || 100}
                  />
                ) : displayConfig.display === 'prompt-icon' ? (
                  // Prompt icon display: clickable icon to view prompt
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        fontFamily: 'monospace'
                      }}
                    >
                      • {key}:
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenPromptDialog(value)}
                      sx={{
                        color: 'primary.main',
                        p: 0.25,
                        '&:hover': {
                          backgroundColor: 'primary.light'
                        }
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontStyle: 'italic'
                      }}
                    >
                      View prompt configuration
                    </Typography>
                  </Box>
                ) : (
                  // Text display: default plain text
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      fontFamily: 'monospace'
                    }}
                  >
                    • {key}: {String(value)}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Dialog for link clicks */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {dialogData?.fieldName}
          </DialogTitle>
          <DialogContent>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {String(dialogData?.fieldValue)}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  // Helper component for truncated text display
  const TruncatedText = ({ fieldName, value, maxLength }) => {
    const [showFull, setShowFull] = useState(false);
    const stringValue = String(value);
    const isTruncated = stringValue.length > maxLength;
    const displayValue = showFull ? stringValue : stringValue.slice(0, maxLength);

    return (
      <Box>
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontFamily: 'monospace'
          }}
        >
          • {fieldName}: {displayValue}
          {isTruncated && !showFull && '...'}
        </Typography>
        {isTruncated && (
          <Typography
            variant="caption"
            onClick={() => setShowFull(!showFull)}
            sx={{
              ml: 2,
              color: 'primary.main',
              cursor: 'pointer',
              fontSize: '0.65rem',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            {showFull ? 'Show less' : 'Show more'}
          </Typography>
        )}
      </Box>
    );
  };

  const renderTertiaryDetails = () => {
    switch (step.type) {
      case 'tool':
        return (
          <Box>
            {renderAllInputs(step.inputs, step.tool)}
            {step.output && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Output:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    ml: 1
                  }}
                >
                  → {step.output}
                </Typography>
              </Box>
            )}
          </Box>
        );
      
      case 'if':
        return (
          <Box>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                Full Condition:
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                  ml: 1
                }}
              >
                {formatCondition(step.condition)}
              </Typography>
            </Box>
          </Box>
        );
      
      case 'loop':
        return (
          <Box>
            {(step.output_dict || step.output) && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Output:
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    ml: 1
                  }}
                >
                  → {step.output_dict || step.output}
                </Typography>
              </Box>
            )}
          </Box>
        );
      
      case 'flag_variable':
        return null;
      
      default:
        return null;
    }
  };

  return (
    <Collapse in={expanded}>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ ml: { xs: 2.5, sm: 3 } }}>
        {renderTertiaryDetails()}
      </Box>

      {/* Prompt View Dialog */}
      <PromptDialog
        open={promptDialogOpen}
        onClose={handleClosePromptDialog}
        value={viewingPromptValue}
        onChange={handleSavePrompt}
        readOnly={false}
        availableVariables={viewingPromptVariables}
      />
    </Collapse>
  );
};

const StepComponent = ({ step, stepNumber, depth = 0, originalPrompt, originalPlan, onPlanUpdate, onLoadingChange, onStepEdit, onPromptEdit, allowStepEditing = true }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  if (!step) return null;

  const STEP_CONFIG = getStepConfig(theme);
  const config = STEP_CONFIG[step.type] || STEP_CONFIG.tool;
  const indent = depth * 16;

  const renderNestedSteps = () => {
    if (step.type === 'loop' && step.body?.length > 0) {
      return (
        <Box sx={{ 
          mt: { xs: 1, sm: 1.5 }, 
          ml: { xs: 1, sm: 1.5 }, 
          borderLeft: `2px dashed ${config.color}40`, 
          pl: { xs: 1, sm: 1.5 },
          position: 'relative'
        }}>
          <Typography 
            variant="caption" 
            sx={{ 
              mb: 1, 
              display: 'inline-block',
              fontWeight: 600,
              color: config.color,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontSize: '0.6rem',
              backgroundColor: 'background.paper',
              opacity: 0.9,
              px: 1,
              py: 0.25,
              borderRadius: 0.5,
              border: `1px solid ${config.color}40`,
              position: 'relative',
              left: -8
            }}
          >
            Loop Body
          </Typography>
          {step.body.map((bodyStep, index) => (
            <Box key={bodyStep.id || index} sx={{ mb: 1 }}>
              <StepComponent
                step={bodyStep}
                depth={depth + 1}
                originalPrompt={originalPrompt}
                originalPlan={originalPlan}
                onPlanUpdate={onPlanUpdate}
                onLoadingChange={onLoadingChange}
                onStepEdit={onStepEdit}
                onPromptEdit={onPromptEdit}
                allowStepEditing={allowStepEditing}
              />
            </Box>
          ))}
        </Box>
      );
    }

    if (step.type === 'if' && step.then) {
      return (
        <Box sx={{ 
          mt: { xs: 1, sm: 1.5 }, 
          ml: { xs: 1, sm: 1.5 }, 
          borderLeft: `2px dashed ${config.color}40`, 
          pl: { xs: 1, sm: 1.5 },
          position: 'relative'
        }}>
          <Typography 
            variant="caption" 
            sx={{ 
              mb: 1, 
              display: 'inline-block',
              fontWeight: 600,
              color: config.color,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontSize: '0.6rem',
              backgroundColor: 'background.paper',
              opacity: 0.9,
              px: 1,
              py: 0.25,
              borderRadius: 0.5,
              border: `1px solid ${config.color}40`,
              position: 'relative',
              left: -8
            }}
          >
            Then
          </Typography>
          <StepComponent
            step={step.then}
            depth={depth + 1}
            originalPrompt={originalPrompt}
            originalPlan={originalPlan}
            onPlanUpdate={onPlanUpdate}
            onLoadingChange={onLoadingChange}
            onStepEdit={onStepEdit}
            onPromptEdit={onPromptEdit}
            allowStepEditing={allowStepEditing}
          />
        </Box>
      );
    }

    return null;
  };

  return (
    <Box sx={{ 
      ml: { xs: `${Math.min(indent, 16)}px`, sm: `${indent}px` },
      mr: { xs: 0, sm: 0 }
    }}>
      <Card
        variant="outlined"
        sx={{
          borderLeft: `4px solid ${config.color}`,
          backgroundColor: 'background.paper',
          opacity: 0.8,
          backdropFilter: 'blur(8px)',
          border: (theme) => `1px solid ${theme.palette.custom.subtleBorder}`,
          borderRadius: { xs: 1.5, sm: 2 },
          boxShadow: (theme) => `0 1px 3px ${theme.palette.custom.subtleShadow}`,
          '&:hover': {
            boxShadow: (theme) => `0 4px 12px ${theme.palette.custom.hoverShadow}`,
            borderColor: config.color,
            transform: 'translateY(-1px)'
          },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ 
          pb: '12px !important', 
          p: { xs: 1, sm: 1.5 },
          '&:last-child': {
            pb: { xs: '8px !important', sm: '12px !important' }
          }
        }}>
          {/* Primary Information - Always Visible */}
          <StepPrimary
            step={step}
            stepNumber={stepNumber}
            originalPrompt={originalPrompt}
            originalPlan={originalPlan}
            onPlanUpdate={onPlanUpdate}
            onLoadingChange={onLoadingChange}
            onStepEdit={onStepEdit}
            expanded={expanded}
            onToggleExpand={() => setExpanded(!expanded)}
            allowStepEditing={allowStepEditing}
          />
          
          {/* Secondary Information - Contextual */}
          <StepSecondary step={step} />
          
          {/* Tertiary Information - Expandable */}
          <StepTertiary
            step={step}
            expanded={expanded}
            onPromptEdit={onPromptEdit}
          />
          
          {/* Nested Steps */}
          {renderNestedSteps()}
        </CardContent>
      </Card>
    </Box>
  );
};

export default StepComponent;