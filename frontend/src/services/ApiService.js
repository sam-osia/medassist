import axios from 'axios';

// Create an instance of axios with default configuration
const defaultURL = 'http://localhost:8000/api'; // Local development
// const defaultURL = 'http://saman-B760M-GAMING-X-AX-DDR4:8000/api'; // Network access
// const defaultURL = 'https://medassist.uhndata.io/api'; // Production

const ApiService = axios.create({
    baseURL: process.env.REACT_APP_API_URL || defaultURL, // Base URL for your API
    timeout: 400000, // Set a timeout for the request (optional)
    headers: {
        'Content-Type': 'application/json',
        // You can add other default headers here
    },
});

// Authorization interceptor
ApiService.interceptors.request.use(
    (config) => {
        // Add authorization token to headers
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        // Handle errors before request is sent
        return Promise.reject(error);
    }
);

// You can add response interceptors as well
ApiService.interceptors.response.use(
    (response) => {
        // Perform actions on successful response
        return response;
    },
    (error) => {
        // Handle errors
        if (error.response && error.response.status === 401) {
            // Handle unauthorized access - trigger auth required event
            window.dispatchEvent(new CustomEvent('auth-required'));
        }
        return Promise.reject(error);
    }
);

// Planning agent functions
export const planningService = {
    // Generate a response using the conversational planning agent
    conversationalPlan: (prompt, mrn = 0, csn = 0, dataset = null, currentPlan = null, conversationId = null) =>
        ApiService.post('/planning/conversational-plan', {
            prompt, mrn, csn, dataset, current_plan: currentPlan, conversation_id: conversationId
        }),

    // Edit a specific step in a plan
    editPlanStep: (originalPrompt, originalPlan, stepId, changeRequest) =>
        ApiService.post('/planning/edit-plan-step', {
            original_prompt: originalPrompt,
            original_plan: originalPlan,
            step_id: stepId,
            change_request: changeRequest
        }),

    // Update a step's prompt input
    updateStepPrompt: (rawPlan, stepId, newPrompt) =>
        ApiService.post('/planning/plans/update-step-prompt', {
            raw_plan: rawPlan,
            step_id: stepId,
            new_prompt: newPrompt
        }),

    // Plan management functions
    // Get all saved plans
    getAllPlans: () => ApiService.get('/planning/plans'),

    // Get a specific saved plan
    getPlan: (planName) => ApiService.get(`/planning/plans/${planName}`),

    // Save a plan
    savePlan: (planName, rawPlan) =>
        ApiService.post(`/planning/plans/${planName}`, {
            raw_plan: rawPlan
        }),

    // Delete a plan
    deletePlan: (planName) => ApiService.delete(`/planning/plans/${planName}`)
};

// Conversation management functions
export const conversationService = {
    // Get all conversations for current user
    getAllConversations: () => ApiService.get('/planning/conversations'),

    // Get specific conversation
    getConversation: (conversationId) =>
        ApiService.get(`/planning/conversations/${conversationId}`),

    // Delete conversation
    deleteConversation: (conversationId) =>
        ApiService.delete(`/planning/conversations/${conversationId}`)
};

// Chat functions
export const chatService = {
    // Get list of available models
    getModelsList: () => ApiService.get('/chat/models-list'),

    // Simple non-streaming chat
    chat: (model, systemMessage, messages) =>
        ApiService.post('/chat/chat', {
            model,
            system_message: systemMessage,
            messages
        }),

    // Streaming chat with supervisor (returns fetch Response for streaming)
    supervisorStream: (userPrompt, mrn = null, csn = null, dataset = null, chatHistory = []) => {
        const token = localStorage.getItem('idToken');

        return fetch(`${ApiService.defaults.baseURL}/chat/supervisor-stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                user_prompt: userPrompt,
                mrn: mrn ? parseInt(mrn) : null,
                csn: csn ? parseInt(csn) : null,
                dataset: dataset,
                chat_history: chatHistory
            })
        });
    }
};

// Authentication functions
export const authService = {
    // Check auth status
    checkAuthStatus: () => ApiService.get('/auth/auth-status'),

    // Login
    login: (username, password) => ApiService.post('/auth/login', { username, password }),

    // Get current user info
    getCurrentUser: () => ApiService.get('/auth/me')
};

export default ApiService;

// Tools (Playground) functions
export const toolsService = {
    // Get the catalog of tools for schema-driven forms
    getCatalog: () => ApiService.get('/tool/catalog'),

    // Run a specific tool with inputs (endpoint to be added on backend)
    runTool: (toolName, inputs) =>
        ApiService.post('/tools/run', {
            tool_name: toolName,
            inputs
        })
};

// Project management functions
export const projectsService = {
    // Get all projects
    getAllProjects: () => ApiService.get('/projects/'),

    // Get specific project details
    getProjectDetails: (projectName) => ApiService.get(`/projects/${projectName}`),

    // Create new project
    createProject: (projectData) => ApiService.post('/projects/', projectData),

    // Update existing project
    updateProject: (projectName, projectData) => ApiService.patch(`/projects/${projectName}`, projectData),

    // Delete project
    deleteProject: (projectName) => ApiService.delete(`/projects/${projectName}`)
};

// Dataset management functions
export const datasetsService = {
    // Get all datasets
    getAllDatasets: () => ApiService.get('/datasets/'),

    // Get specific dataset metadata
    getDatasetMetadata: (datasetName) => ApiService.get(`/datasets/${datasetName}`),

    // Get patient summaries for dataset
    getDatasetPatients: (datasetName) => ApiService.get(`/datasets/${datasetName}/patients`),

    // Get specific patient details
    getPatientDetails: (datasetName, mrn) => ApiService.get(`/datasets/${datasetName}/patients/${mrn}`)
};

// Workflow execution functions
export const workflowService = {
    // Create and execute a new experiment
    createExperiment: (projectName, experimentName, workflowName, mrns = null) =>
        ApiService.post('/workflow/experiments', {
            project_name: projectName,
            experiment_name: experimentName,
            workflow_name: workflowName,
            mrns: mrns
        }),

    // Get all experiments
    getAllExperiments: () => ApiService.get('/workflow/experiments'),

    // Get specific experiment details
    getExperimentDetails: (experimentName) => ApiService.get(`/workflow/experiments/${experimentName}`),

    // Get experiment status
    getExperimentStatus: (experimentName) => ApiService.get(`/workflow/experiments/${experimentName}/status`),

    // Delete experiment
    deleteExperiment: (experimentName) => ApiService.delete(`/workflow/experiments/${experimentName}`),

    // Get experiments (workflow runs) for a specific project
    getExperimentsForProject: (projectName) => ApiService.get(`/workflow/projects/${projectName}/experiments`),

    // Get experiments for a specific patient within a specific project
    getPatientExperimentsForProject: (projectName, mrn) => ApiService.get(`/workflow/projects/${projectName}/patients/${mrn}/experiments`)
};

// User management functions
export const usersService = {
    // Get all users
    getAllUsers: () => ApiService.get('/users/'),

    // Get specific user details
    getUser: (username) => ApiService.get(`/users/${username}`),

    // Create new user
    createUser: (userData) => ApiService.post('/users/', userData),

    // Update user
    updateUser: (username, userData) => ApiService.patch(`/users/${username}`, userData),

    // Delete user
    deleteUser: (username) => ApiService.delete(`/users/${username}`),

    // Get user's datasets
    getUserDatasets: (username) => ApiService.get(`/users/${username}/datasets`),

    // Grant dataset access to user
    grantDatasetAccess: (username, datasetName) =>
        ApiService.post(`/users/${username}/datasets`, { dataset_name: datasetName }),

    // Revoke dataset access from user
    revokeDatasetAccess: (username, datasetName) =>
        ApiService.delete(`/users/${username}/datasets/${datasetName}`),

    // Get user's projects
    getUserProjects: (username) => ApiService.get(`/users/${username}/projects`),

    // Add user to project
    addUserToProject: (username, projectName) =>
        ApiService.post(`/users/${username}/projects`, { project_name: projectName }),

    // Remove user from project
    removeUserFromProject: (username, projectName) =>
        ApiService.delete(`/users/${username}/projects/${projectName}`)
};

// Caboodle dictionary functions
export const caboodleService = {
    // Get complete Caboodle dictionary
    getTables: () => ApiService.get('/caboodle/tables'),

    // Send LLM query about the data dictionary
    llmCall: (query) => ApiService.post('/caboodle/llm_call', { query })
};

// Annotation management functions
export const annotationsService = {
    // Annotation Groups
    listGroups: (projectName) =>
        ApiService.get(`/projects/${projectName}/annotations/groups`),

    createGroup: (projectName, groupData) =>
        ApiService.post(`/projects/${projectName}/annotations/groups`, groupData),

    getGroup: (projectName, groupId) =>
        ApiService.get(`/projects/${projectName}/annotations/groups/${groupId}`),

    updateGroup: (projectName, groupId, groupData) =>
        ApiService.patch(`/projects/${projectName}/annotations/groups/${groupId}`, groupData),

    deleteGroup: (projectName, groupId) =>
        ApiService.delete(`/projects/${projectName}/annotations/groups/${groupId}`),

    // Annotation Values
    getGroupValues: (projectName, groupId) =>
        ApiService.get(`/projects/${projectName}/annotations/groups/${groupId}/values`),

    getAnnotation: (projectName, groupId, itemId) =>
        ApiService.get(`/projects/${projectName}/annotations/groups/${groupId}/values/${itemId}`),

    saveAnnotation: (projectName, groupId, itemId, values) =>
        ApiService.put(`/projects/${projectName}/annotations/groups/${groupId}/values/${itemId}`, { values }),

    deleteAnnotation: (projectName, groupId, itemId) =>
        ApiService.delete(`/projects/${projectName}/annotations/groups/${groupId}/values/${itemId}`)
};

// New workflow agent service (multi-agent system)
export const workflowAgentService = {
    // Process a message through the workflow agent with streaming trace events
    processMessageStream: (message, conversationId = null, mrn = 0, csn = 0, dataset = null) => {
        const token = localStorage.getItem('accessToken');

        return fetch(`${ApiService.defaults.baseURL}/workflow-agent/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({
                message,
                conversation_id: conversationId,
                mrn,
                csn,
                dataset
            })
        });
    }
};
