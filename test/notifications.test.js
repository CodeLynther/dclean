'use strict';

const { sendNotification } = require('../src/utils/notifications');
const child_process = require('child_process');
const logger = require('../src/utils/logger');

jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
}));

describe('sendNotification', () => {
    let originalPlatform;

    beforeAll(() => {
        originalPlatform = process.platform;
    });

    afterAll(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('runs osascript on darwin', async () => {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        child_process.exec.mockImplementation((cmd, cb) => cb(null));

        await sendNotification("Test 'Title'", "Test 'Message'");

        const expectedScript = 'display alert "Test \\\'Title\\\'" message "Test \\\'Message\\\'" as informational buttons {"OK"} default button "OK"';
        expect(child_process.exec).toHaveBeenCalledWith(
            `osascript -e '${expectedScript}'`,
            expect.any(Function)
        );
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs error on darwin if osascript fails', async () => {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        child_process.exec.mockImplementation((cmd, cb) => cb(new Error('osascript error')));

        await sendNotification('Test', 'Message');

        expect(child_process.exec).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith('Failed to send macOS alert: osascript error');
    });

    it('runs notify-send on linux', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        child_process.exec.mockImplementation((cmd, cb) => cb(null));

        await sendNotification('Test Title', 'Test Message');

        expect(child_process.exec).toHaveBeenCalledWith(
            'notify-send "Test Title" "Test Message" --urgency=critical --icon=drive-harddisk',
            expect.any(Function)
        );
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs info on linux if notify-send fails', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        child_process.exec.mockImplementation((cmd, cb) => cb(new Error('not found')));

        await sendNotification('Test Title', 'Test Message');

        expect(child_process.exec).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('[Alert] Test Title: Test Message');
    });

    it('logs info directly without exec on other platforms (win32)', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });

        await sendNotification('Test Title', 'Test Message');

        expect(child_process.exec).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('[Alert] Test Title: Test Message');
    });
});
