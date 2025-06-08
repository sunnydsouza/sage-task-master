/**
 * Tests for the update-tasks.js module
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
jest.unstable_mockModule('../../../../../scripts/modules/utils.js', () => ({
	readJSON: jest.fn(),
	writeJSON: jest.fn(),
	log: jest.fn(),
	CONFIG: {
		model: 'mock-claude-model',
		maxTokens: 4000,
		temperature: 0.7,
		debug: false
	},
        sanitizePrompt: jest.fn((prompt) => prompt),
        truncate: jest.fn((text) => text),
        isSilentMode: jest.fn(() => false),
        getLocalISOString: jest.fn(() => '2024-06-01T12:00:00.000+00:00')
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/ai-services-unified.js',
	() => ({
		generateTextService: jest.fn().mockResolvedValue({
			mainResult: '[]', // mainResult is the text string directly
			telemetryData: {}
		})
	})
);

jest.unstable_mockModule('../../../../../scripts/modules/ui.js', () => ({
	getStatusWithColor: jest.fn((status) => status),
	startLoadingIndicator: jest.fn(),
	stopLoadingIndicator: jest.fn(),
	displayAiUsageSummary: jest.fn()
}));

jest.unstable_mockModule(
	'../../../../../scripts/modules/config-manager.js',
	() => ({
		getDebugFlag: jest.fn(() => false)
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/generate-task-files.js',
	() => ({
		default: jest.fn().mockResolvedValue()
	})
);

jest.unstable_mockModule(
	'../../../../../scripts/modules/task-manager/models.js',
	() => ({
		getModelConfiguration: jest.fn(() => ({
			model: 'mock-model',
			maxTokens: 4000,
			temperature: 0.7
		}))
	})
);

// Import the mocked modules
const { readJSON, writeJSON, log, CONFIG } = await import(
	'../../../../../scripts/modules/utils.js'
);

const { generateTextService } = await import(
	'../../../../../scripts/modules/ai-services-unified.js'
);

// Import the module under test
const { default: updateTasks } = await import(
	'../../../../../scripts/modules/task-manager/update-tasks.js'
);

describe('updateTasks', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('should update tasks based on new context', async () => {
		// Arrange
		const mockTasksPath = '/mock/path/tasks.json';
		const mockFromId = 2;
		const mockPrompt = 'New project direction';
		const mockInitialTasks = {
			tasks: [
				{
					id: 1,
					title: 'Old Task 1',
					status: 'done',
					details: 'Done details'
				},
				{
					id: 2,
					title: 'Old Task 2',
					status: 'pending',
					details: 'Old details 2'
				},
				{
					id: 3,
					title: 'Old Task 3',
					status: 'in-progress',
					details: 'Old details 3'
				}
			]
		};

		const mockUpdatedTasks = [
			{
				id: 2,
				title: 'Updated Task 2',
				status: 'pending',
				details: 'New details 2 based on direction',
				description: 'Updated description',
				dependencies: [],
				priority: 'medium'
			},
			{
				id: 3,
				title: 'Updated Task 3',
				status: 'pending',
				details: 'New details 3 based on direction',
				description: 'Updated description',
				dependencies: [],
				priority: 'medium'
			}
		];

		const mockApiResponse = {
			mainResult: JSON.stringify(mockUpdatedTasks), // mainResult is the JSON string directly
			telemetryData: {}
		};

		// Configure mocks
		readJSON.mockReturnValue(mockInitialTasks);
		generateTextService.mockResolvedValue(mockApiResponse);

		// Act
		const result = await updateTasks(
			mockTasksPath,
			mockFromId,
			mockPrompt,
			false,
			{},
			'json'
		); // Use json format to avoid console output and process.exit

		// Assert
		// 1. Read JSON called
		expect(readJSON).toHaveBeenCalledWith(mockTasksPath);

		// 2. AI Service called with correct args
		expect(generateTextService).toHaveBeenCalledWith(expect.any(Object));

		// 3. Write JSON called with correctly merged tasks
		expect(writeJSON).toHaveBeenCalledWith(
			mockTasksPath,
			expect.objectContaining({
				tasks: expect.arrayContaining([
					expect.objectContaining({ id: 1 }),
					expect.objectContaining({ id: 2, title: 'Updated Task 2' }),
					expect.objectContaining({ id: 3, title: 'Updated Task 3' })
				])
			})
		);

		// 4. Check return value
		expect(result).toEqual(
			expect.objectContaining({
				success: true,
				updatedTasks: mockUpdatedTasks,
				telemetryData: {}
			})
		);
	});

	test('should handle no tasks to update', async () => {
		// Arrange
		const mockTasksPath = '/mock/path/tasks.json';
		const mockFromId = 99; // Non-existent ID
		const mockPrompt = 'Update non-existent tasks';
		const mockInitialTasks = {
			tasks: [
				{ id: 1, status: 'done' },
				{ id: 2, status: 'done' }
			]
		};

		// Configure mocks
		readJSON.mockReturnValue(mockInitialTasks);

		// Act
		const result = await updateTasks(
			mockTasksPath,
			mockFromId,
			mockPrompt,
			false,
			{},
			'json'
		);

		// Assert
		expect(readJSON).toHaveBeenCalledWith(mockTasksPath);
		expect(generateTextService).not.toHaveBeenCalled();
		expect(writeJSON).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(
			'info',
			expect.stringContaining('No tasks to update')
		);

		// Should return early with no updates
		expect(result).toBeUndefined();
	});
});
