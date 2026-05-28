import { AttachmentKind } from '@/generated/prisma/enums';
import { BadRequestException } from '@nestjs/common';
import {
  AttachmentFileExtensions,
  AttachmentMimeTypes,
  ImageMimeTypes,
  UploadLimit,
} from '../constants/upload.constant';

export function validateAvatarFile(file?: Express.Multer.File) {
  if (!file) {
    return;
  }

  if (!ImageMimeTypes.includes(file.mimetype as (typeof ImageMimeTypes)[number])) {
    throw new BadRequestException('Avatar must be a JPG, PNG, or WEBP image');
  }

  if (file.size > UploadLimit.AvatarMb * 1024 * 1024) {
    throw new BadRequestException(`Avatar must be smaller than ${UploadLimit.AvatarMb}MB`);
  }
}

export function validateAttachments(files: Express.Multer.File[]) {
  if (files.length > UploadLimit.MaxAttachmentCount) {
    throw new BadRequestException(`Maximum ${UploadLimit.MaxAttachmentCount} attachments are allowed`);
  }

  for (const file of files) {
    const extension = extractExtension(file.originalname);
    if (
      !AttachmentMimeTypes.includes(file.mimetype as (typeof AttachmentMimeTypes)[number]) ||
      !AttachmentFileExtensions.includes(extension as (typeof AttachmentFileExtensions)[number])
    ) {
      throw new BadRequestException(`Attachment ${file.originalname} has an unsupported file type`);
    }

    if (file.size > UploadLimit.AttachmentMb * 1024 * 1024) {
      throw new BadRequestException(`Attachment ${file.originalname} exceeds ${UploadLimit.AttachmentMb}MB`);
    }
  }
}

export function getAttachmentKind(mimeType: string) {
  return mimeType.startsWith('image/') ? AttachmentKind.IMAGE : AttachmentKind.FILE;
}

function extractExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return '';
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}
