import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// @testing-library/react doesn't auto-unmount between tests under vitest
// (that registration relies on a Jest-style global afterEach), so without
// this, one test's rendered DOM leaks into the next.
afterEach(() => {
  cleanup();
});
