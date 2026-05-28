import { getAttachmentKind, validateAttachments, validateAvatarFile } from './file.util';
import { AttachmentKind } from '@/generated/prisma/enums';

describe('file.util', () => {
  it('accepts missing avatar files', () => {
    expect(() => validateAvatarFile()).not.toThrow();
  });

  it('rejects invalid avatar mime types', () => {
    expect(() =>
      validateAvatarFile({
        originalname: 'avatar.gif',
        mimetype: 'image/gif',
        size: 128,
      } as Express.Multer.File),
    ).toThrow('Avatar must be a JPG, PNG, or WEBP image');
  });

  it('rejects oversized avatar files', () => {
    expect(() =>
      validateAvatarFile({
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 10 * 1024 * 1024,
      } as Express.Multer.File),
    ).toThrow('Avatar must be smaller');
  });

  it('rejects unsupported attachment mime types', () => {
    expect(() =>
      validateAttachments([
        {
          originalname: 'payload.html',
          mimetype: 'text/html',
          size: 128,
        } as Express.Multer.File,
      ]),
    ).toThrow('unsupported file type');
  });

  it('accepts supported attachment types', () => {
    expect(() =>
      validateAttachments([
        {
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 128,
        } as Express.Multer.File,
      ]),
    ).not.toThrow();
  });

  it('rejects too many attachments', () => {
    expect(() =>
      validateAttachments(
        new Array(6).fill(null).map((_, index) => ({
          originalname: `report-${index}.pdf`,
          mimetype: 'application/pdf',
          size: 128,
        })) as Express.Multer.File[],
      ),
    ).toThrow('Maximum 5 attachments are allowed');
  });

  it('rejects oversized attachments', () => {
    expect(() =>
      validateAttachments([
        {
          originalname: 'report.pdf',
          mimetype: 'application/pdf',
          size: 30 * 1024 * 1024,
        } as Express.Multer.File,
      ]),
    ).toThrow('exceeds');
  });

  it('rejects attachments with unsupported extensions', () => {
    expect(() =>
      validateAttachments([
        {
          originalname: 'report.exe',
          mimetype: 'application/pdf',
          size: 128,
        } as Express.Multer.File,
      ]),
    ).toThrow('unsupported file type');
  });

  it('detects image and file attachment kinds', () => {
    expect(getAttachmentKind('image/png')).toBe(AttachmentKind.IMAGE);
    expect(getAttachmentKind('application/pdf')).toBe(AttachmentKind.FILE);
  });
});
