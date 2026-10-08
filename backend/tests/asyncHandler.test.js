const { asyncHandler } = require('../src/lib/asyncHandler');

describe('asyncHandler', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('calls the wrapped function with req, res, next', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  test('calls next with error when promise rejects', async () => {
    const error = new Error('Test error');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  test('does not call next when promise resolves', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

  test('returns promise that resolves to undefined', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    const wrapped = asyncHandler(handler);

    const result = await wrapped(mockReq, mockRes, mockNext);

    expect(result).toBeUndefined();
  });

  test('passes through resolved value if handler returns one', async () => {
    const handler = jest.fn().mockResolvedValue({ data: 'test' });
    const wrapped = asyncHandler(handler);

    await wrapped(mockReq, mockRes, mockNext);

    expect(handler).toHaveBeenCalled();
  });
});