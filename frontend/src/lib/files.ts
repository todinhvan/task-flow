const MB = 1024 * 1024;

export function validateImageFile(file: File, maxSizeMb = 2) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Image must be JPG, PNG, or WEBP");
  }

  if (file.size > maxSizeMb * MB) {
    throw new Error(`Image must be smaller than ${maxSizeMb}MB`);
  }
}

export function validateAttachmentFiles(files: File[], maxSizeMb = 10) {
  for (const file of files) {
    if (file.size > maxSizeMb * MB) {
      throw new Error(`${file.name} exceeds ${maxSizeMb}MB`);
    }
  }
}

export async function resizeImageFile(
  file: File,
  options: { maxWidth: number; maxHeight: number; quality?: number },
) {
  validateImageFile(file);

  const image = await loadImage(file);
  const { width, height } = fitWithin(
    image.width,
    image.height,
    options.maxWidth,
    options.maxHeight,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to resize image");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", options.quality ?? 0.9);
  });

  if (!blob) {
    throw new Error("Unable to resize image");
  }

  return new File([blob], renameToWebp(file.name), { type: "image/webp" });
}

function renameToWebp(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "") + ".webp";
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load image"));
    };

    image.src = objectUrl;
  });
}

function fitWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}
