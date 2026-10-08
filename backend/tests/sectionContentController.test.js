jest.mock('../src/lib/db', () => ({
  query: jest.fn()
}));

jest.mock('../src/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

jest.mock('../src/routes/sync', () => ({
  syncBus: {
    emit: jest.fn()
  }
}));

jest.mock('../src/lib/validators', () => ({
  sectionContentSchema: {
    safeParse: jest.fn()
  }
}));

const { query } = require('../src/lib/db');
const { syncBus } = require('../src/routes/sync');
const { sectionContentSchema } = require('../src/lib/validators');
const { getSectionContent, upsertSectionContent } = require('../src/controllers/sectionContentController');

describe('sectionContentController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      params: { sectionKey: 'hero' },
      body: {}
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn(() => mockRes)
    };
    jest.clearAllMocks();
  });

  describe('getSectionContent', () => {
    test('returns section content when found', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          section_key: 'hero',
          title: 'Welcome',
          subtitle: 'Subtitle here',
          updated_at: '2024-01-01T00:00:00.000Z'
        }]
      });

      await getSectionContent(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT section_key, title, subtitle, updated_at'),
        ['hero']
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        section_key: 'hero',
        title: 'Welcome',
        subtitle: 'Subtitle here',
        updated_at: '2024-01-01T00:00:00.000Z'
      });
    });

    test('returns empty content when section not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await getSectionContent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        section_key: 'hero',
        title: '',
        subtitle: '',
        updated_at: null
      });
    });

    test('handles DB error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      await getSectionContent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });

    test('logs error on DB failure', async () => {
      const logger = require('../src/lib/logger');
      query.mockRejectedValueOnce(new Error('DB error'));

      await getSectionContent(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error obteniendo contenido de sección:', expect.any(Error));
    });
  });

  describe('upsertSectionContent', () => {
    test('returns 400 when validation fails', async () => {
      mockReq.body = { title: '', subtitle: '' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: false,
        error: { issues: [{ message: 'Title is required' }] }
      });

      await upsertSectionContent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Title is required' });
    });

    test('returns 400 when validation fails with generic message', async () => {
      mockReq.body = { title: '', subtitle: '' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: false,
        error: { issues: [] }
      });

      await upsertSectionContent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Datos inválidos' });
    });

    test('inserts new section content', async () => {
      mockReq.body = { title: 'New Title', subtitle: 'New Subtitle' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: true,
        data: { sectionKey: 'hero', title: 'New Title', subtitle: 'New Subtitle' }
      });
      query.mockResolvedValueOnce({
        rows: [{ section_key: 'hero', title: 'New Title', subtitle: 'New Subtitle', updated_at: '2024-01-01T00:00:00.000Z' }]
      });

      await upsertSectionContent(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO section_content'),
        ['hero', 'New Title', 'New Subtitle']
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        section_key: 'hero',
        title: 'New Title',
        subtitle: 'New Subtitle',
        updated_at: '2024-01-01T00:00:00.000Z'
      });
    });

    test('updates existing section content', async () => {
      mockReq.body = { title: 'Updated Title', subtitle: 'Updated Subtitle' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: true,
        data: { sectionKey: 'hero', title: 'Updated Title', subtitle: 'Updated Subtitle' }
      });
      query.mockResolvedValueOnce({
        rows: [{ section_key: 'hero', title: 'Updated Title', subtitle: 'Updated Subtitle', updated_at: '2024-01-02T00:00:00.000Z' }]
      });

      await upsertSectionContent(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (section_key) DO UPDATE'),
        ['hero', 'Updated Title', 'Updated Subtitle']
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        section_key: 'hero',
        title: 'Updated Title',
        subtitle: 'Updated Subtitle',
        updated_at: '2024-01-02T00:00:00.000Z'
      });
    });

    test('emits sync event on success', async () => {
      mockReq.body = { title: 'Test', subtitle: 'Test' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: true,
        data: { sectionKey: 'hero', title: 'Test', subtitle: 'Test' }
      });
      query.mockResolvedValueOnce({ rows: [{ section_key: 'hero' }] });

      await upsertSectionContent(mockReq, mockRes);

      expect(syncBus.emit).toHaveBeenCalledWith('section_content_updated', { sectionKey: 'hero' });
    });

    test('handles sync emit error gracefully', async () => {
      mockReq.body = { title: 'Test', subtitle: 'Test' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: true,
        data: { sectionKey: 'hero', title: 'Test', subtitle: 'Test' }
      });
      query.mockResolvedValueOnce({ rows: [{ section_key: 'hero' }] });
      syncBus.emit.mockImplementationOnce(() => { throw new Error('Sync failed'); });

      await upsertSectionContent(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalled();
    });

    test('handles DB error', async () => {
      mockReq.body = { title: 'Test', subtitle: 'Test' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: true,
        data: { sectionKey: 'hero', title: 'Test', subtitle: 'Test' }
      });
      query.mockRejectedValueOnce(new Error('DB error'));

      await upsertSectionContent(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
    });

    test('logs error on DB failure', async () => {
      const logger = require('../src/lib/logger');
      mockReq.body = { title: 'Test', subtitle: 'Test' };
      sectionContentSchema.safeParse.mockReturnValue({
        success: true,
        data: { sectionKey: 'hero', title: 'Test', subtitle: 'Test' }
      });
      query.mockRejectedValueOnce(new Error('DB error'));

      await upsertSectionContent(mockReq, mockRes);

      expect(logger.error).toHaveBeenCalledWith('Error guardando contenido de sección:', expect.any(Error));
    });
  });
});