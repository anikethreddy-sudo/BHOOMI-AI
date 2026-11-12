from io import BytesIO
import pytest
from PIL import Image
from src.bhoomi.image_utils import ImageValidationError, load_validated_image

def make_image(format_name="JPEG", size=(128, 128)):
    image = Image.new("RGB", size, color=(40, 150, 60))
    buffer = BytesIO()
    image.save(buffer, format=format_name)
    return buffer.getvalue()

def test_valid_jpeg_is_converted_to_rgb():
    image = load_validated_image(make_image())
    assert image.mode == "RGB"
    assert image.size == (128, 128)

def test_empty_upload_is_rejected():
    with pytest.raises(ImageValidationError):
        load_validated_image(b"")

def test_unsupported_format_is_rejected():
    with pytest.raises(ImageValidationError):
        load_validated_image(make_image("BMP"))

def test_too_small_image_is_rejected():
    with pytest.raises(ImageValidationError):
        load_validated_image(make_image(size=(32, 32)))

def test_non_image_bytes_are_rejected():
    with pytest.raises(ImageValidationError):
        load_validated_image(b"this is not an image")
