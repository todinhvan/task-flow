jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

jest.mock('streamifier', () => ({
  __esModule: true,
  default: {
    createReadStream: jest.fn(),
  },
}));

import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import envConfig from '@/config';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import { CloudinaryProvider } from './cloudinary.provider';

describe('CloudinaryProvider', () => {
  const originalEnv = {
    CloudinaryCloudName: envConfig.CloudinaryCloudName,
    CloudinaryApiKey: envConfig.CloudinaryApiKey,
    CloudinaryApiSecret: envConfig.CloudinaryApiSecret,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    envConfig.CloudinaryCloudName = 'cloud';
    envConfig.CloudinaryApiKey = 'key';
    envConfig.CloudinaryApiSecret = 'secret';
  });

  afterAll(() => {
    envConfig.CloudinaryCloudName = originalEnv.CloudinaryCloudName;
    envConfig.CloudinaryApiKey = originalEnv.CloudinaryApiKey;
    envConfig.CloudinaryApiSecret = originalEnv.CloudinaryApiSecret;
  });

  it('uploads a buffer on the happy path', async () => {
    const provider = new CloudinaryProvider();
    const pipe = jest.fn();
    (streamifier.createReadStream as jest.Mock).mockReturnValue({ pipe });
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((options, callback) => {
      callback(null, {
        secure_url: 'https://cdn.example/file',
        public_id: 'public-id',
        resource_type: options.resource_type,
      });
      return { writable: true };
    });

    const result = await provider.uploadBuffer({
      buffer: Buffer.from('file'),
      folder: 'files/tasks',
      fileName: 'Spec File.PDF',
      mimeType: 'application/pdf',
      resourceType: 'raw',
    });

    expect(streamifier.createReadStream).toHaveBeenCalled();
    expect(pipe).toHaveBeenCalled();
    expect(result.public_id).toBe('public-id');
  });

  it('rejects uploads when cloudinary returns an error', async () => {
    const provider = new CloudinaryProvider();
    (streamifier.createReadStream as jest.Mock).mockReturnValue({ pipe: jest.fn() });
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, callback) => {
      callback(new Error('Upload failed'));
      return {};
    });

    await expect(
      provider.uploadBuffer({
        buffer: Buffer.from('file'),
        folder: 'files/tasks',
        fileName: 'Spec File.PDF',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('destroys cloudinary assets on the happy path', async () => {
    const provider = new CloudinaryProvider();
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue(undefined);

    await provider.destroy('public-id', 'raw');

    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('public-id', { resource_type: 'raw' });
  });

  it('rejects operations when cloudinary is not configured', async () => {
    envConfig.CloudinaryCloudName = '';
    const provider = new CloudinaryProvider();

    expect(() =>
      provider.uploadBuffer({
        buffer: Buffer.from('file'),
        folder: 'files/tasks',
        fileName: 'Spec File.PDF',
        mimeType: 'application/pdf',
      }),
    ).toThrow(BadRequestException);
  });
});
