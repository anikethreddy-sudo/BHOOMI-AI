"""Image decoding, validation, and preprocessing utilities."""
from __future__ import annotations
from io import BytesIO
from typing import BinaryIO
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MIN_IMAGE_SIDE = 64
MAX_IMAGE_SIDE = 6000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

class ImageValidationError(ValueError):
    """Raised when an uploaded image is invalid or outside supported limits."""

def load_validated_image(source: bytes | BinaryIO) -> Image.Image:
    """Decode an image safely and return an EXIF-corrected RGB copy."""
    if isinstance(source, bytes):
        data = source
    else:
        position = source.tell() if source.seekable() else None
        data = source.read(MAX_IMAGE_BYTES + 1)
        if position is not None:
            source.seek(position)
    if not data:
        raise ImageValidationError("The uploaded file is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageValidationError("Image exceeds the 10 MB upload limit.")
    stream = BytesIO(data)
    try:
        with Image.open(stream) as image:
            if image.format not in ALLOWED_FORMATS:
                raise ImageValidationError("Use a JPEG, PNG, or WEBP image.")
            image.verify()
        stream.seek(0)
        with Image.open(stream) as image:
            image = ImageOps.exif_transpose(image)
            width, height = image.size
            if width < MIN_IMAGE_SIDE or height < MIN_IMAGE_SIDE:
                raise ImageValidationError("Image must be at least 64 x 64 pixels.")
            if width > MAX_IMAGE_SIDE or height > MAX_IMAGE_SIDE:
                raise ImageValidationError("Image dimensions exceed 6000 pixels.")
            return image.convert("RGB").copy()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImageValidationError("The uploaded file is not a valid supported image.") from exc
