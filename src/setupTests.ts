import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Tests build engine states by hand, so every reducer call checks the states
// it takes and returns for a bomb or hazard id the match would mint again
// (entityIds.testutil.ts).
vi.mock('./engine/reducer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engine/reducer')>();
  const { checkingEntityIds } = await import('./engine/entityIds.testutil');
  return { ...actual, gameReducer: checkingEntityIds(actual.gameReducer) };
});

const originalConsoleError = console.error;
let restoreConsoleError: (() => void) | null = null;

beforeAll(() => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    const message = String(args[0] ?? '');
    const knownReact18TestingWarnings = [
      'Warning: `ReactDOMTestUtils.act` is deprecated',
      'Warning: ReactDOM.render is no longer supported in React 18',
      'Warning: unmountComponentAtNode is deprecated',
    ];

    if (knownReact18TestingWarnings.some((warning) => message.includes(warning))) {
      return;
    }

    originalConsoleError(...args);
  });
  restoreConsoleError = () => consoleErrorSpy.mockRestore();
});

afterAll(() => {
  restoreConsoleError?.();
});
