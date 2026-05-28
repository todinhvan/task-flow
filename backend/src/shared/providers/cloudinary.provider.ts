import envConfig from '@/config';
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { UploadApiOptions, v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

type UploadBufferOptions = {
  buffer: Buffer;
  folder: string;
  fileName: string;
  mimeType: string;
  resourceType?: 'auto' | 'image' | 'raw';
};

@Injectable()
export class CloudinaryProvider {
  constructor() {
    if (envConfig.CloudinaryCloudName && envConfig.CloudinaryApiKey && envConfig.CloudinaryApiSecret) {
      cloudinary.config({
        cloud_name: envConfig.CloudinaryCloudName,
        api_key: envConfig.CloudinaryApiKey,
        api_secret: envConfig.CloudinaryApiSecret,
      });
    }
  }

  ensureConfigured() {
    if (!envConfig.CloudinaryCloudName || !envConfig.CloudinaryApiKey || !envConfig.CloudinaryApiSecret) {
      throw new BadRequestException('Cloudinary is not configured');
    }
  }

  uploadBuffer({ buffer, folder, fileName, mimeType, resourceType = 'auto' }: UploadBufferOptions): Promise<any> {
    this.ensureConfigured();

    const options: UploadApiOptions = {
      folder,
      public_id: this.getPublicId(fileName),
      resource_type: resourceType,
      overwrite: true,
      use_filename: false,
      unique_filename: false,
      tags: ['taskflow'],
    };

    if (mimeType.startsWith('image/')) {
      options.transformation = [
        {
          width: 1600,
          height: 1600,
          crop: 'limit',
          quality: 'auto',
          fetch_format: 'auto',
        },
      ];
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
          reject(new InternalServerErrorException(error.message));
          return;
        }

        resolve(result);
      });

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  async destroy(publicId: string, resourceType: 'image' | 'raw' = 'image') {
    this.ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }

  private getPublicId(fileName: string) {
    const safeFileName = fileName
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${safeFileName}-${Date.now()}`;
  }
}
