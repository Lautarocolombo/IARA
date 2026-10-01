const originalWarn = console.warn;
const originalLog = console.log;

beforeEach(() => {
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
  console.log = originalLog;
});
