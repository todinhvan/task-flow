import envConfig from '@/config';

export const UploadFolder = {
  Avatar: 'images/avatars',
  TaskImage: 'images/tasks',
  TaskFile: 'files/tasks',
} as const;

export const UploadLimit = {
  AvatarMb: envConfig.AvatarMaxFileSizeMb,
  AttachmentMb: envConfig.AttachmentMaxFileSizeMb,
  MaxAttachmentCount: 5,
} as const;

export const ImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const AttachmentMimeTypes = [
  ...ImageMimeTypes,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

export const AttachmentFileExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
] as const;
