"""Small CPU checks for native FP8 and ModelOpt packed weight conversion."""

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "gguf-py"))
spec = importlib.util.spec_from_file_location("converter", ROOT / "convert_hf_to_gguf.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)
torch = converter.torch
gguf = converter.gguf


class PackingTest(unittest.TestCase):
    def test_fp8_scalar_and_block_scales(self):
        model = object.__new__(converter.Model)
        model.fp8_dequant = False
        weight = torch.ones((2, 256), dtype=torch.float32).to(torch.float8_e4m3fn)
        for scales, blocks, qtype in [
            (torch.tensor(2.0), None, gguf.GGMLQuantizationType.F8_E4M3_KS),
            (torch.tensor([[2.0, 0.5]]), (128, 128), gguf.GGMLQuantizationType.F8_E4M3_B128),
        ]:
            result = model._convert_fp8("test.weight", weight, scales, blocks, transforms_done=True)
            self.assertEqual(result.qtype, qtype)
            self.assertEqual(result.shape, weight.shape)
            data = result.numpy()
            meta_size = 16 if blocks is None else 4
            packed = data if blocks is None else data.reshape(2, 2, 132)
            expected = np.full((2, 1), 2.0) if blocks is None else np.array([[2.0, 0.5]] * 2)
            np.testing.assert_array_equal(packed[..., :4].copy().view(np.float32).reshape(expected.shape), expected)
            self.assertTrue(np.all(packed[..., meta_size:] == 0x38))
            np.testing.assert_array_equal(result.numpy(True)[..., :4], data[..., :4][..., ::-1])

    def test_fp8_fallback_and_shape_validation(self):
        weight = torch.ones((2, 64), dtype=torch.float32).to(torch.float8_e4m3fn)
        model = object.__new__(converter.Model)
        model.fp8_dequant = False
        scales = torch.tensor([[2.0, 0.5]])
        result = model._convert_fp8("test.weight", weight, scales, (2, 32), transforms_done=True)
        torch.testing.assert_close(result[:, :32], torch.full((2, 32), 2.0))
        torch.testing.assert_close(result[:, 32:], torch.full((2, 32), 0.5))
        with self.assertRaises(ValueError):
            model._fp8_scale_rows(weight, torch.ones((3, 3)), None)

    def test_nvfp4_nibbles_and_scale_endian(self):
        codes = np.arange(64, dtype=np.uint8).reshape(1, 4, 16) % 16
        packed = codes[..., 0::2] | (codes[..., 1::2] << 4)
        scales = torch.ones((1, 4), dtype=torch.float8_e4m3fn)
        result = converter.ModelOptModel._nvfp4_pack(torch.from_numpy(packed.reshape(1, 32)), scales, torch.tensor([2.0]))
        self.assertEqual(result.shape, (1, 40))
        self.assertEqual(result[0, :4].copy().view(np.float32)[0], 2.0)
        np.testing.assert_array_equal(result[0, 4:8], np.full(4, 0x38))
        payload = result[0, 8:].reshape(4, 8)
        np.testing.assert_array_equal(payload & 15, codes[0, :, :8])
        np.testing.assert_array_equal(payload >> 4, codes[0, :, 8:])
        swapped = converter.ModelOptModel._nvfp4_pack(torch.from_numpy(packed.reshape(1, 32)), scales, torch.tensor([2.0]), True)
        np.testing.assert_array_equal(swapped[0, :4], result[0, :4][::-1])

    def test_chunked_ple_stream(self):
        calls = []
        def chunk(index):
            calls.append(index)
            return np.full((2, 4), index, dtype=np.float32)
        value = gguf.LazyChunkedTensor([lambda: chunk(1), lambda: chunk(2)], (4, 4), np.float32)
        self.assertEqual(calls, [])
        with tempfile.TemporaryFile() as result:
            value.quantize(gguf.GGMLQuantizationType.F16).tofile(result)
            result.seek(0)
            data = np.frombuffer(result.read(), dtype=np.float16).reshape(4, 4)
        self.assertEqual(calls, [1, 2])
        np.testing.assert_array_equal(data[:2], np.ones((2, 4)))
        np.testing.assert_array_equal(data[2:], np.full((2, 4), 2))


if __name__ == "__main__":
    unittest.main()
