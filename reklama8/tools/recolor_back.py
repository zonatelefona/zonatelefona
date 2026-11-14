"""Gradient-map the official silver iPhone 17 Pro back cut-out to Cosmic Orange (matches pair.png body colour)."""
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
b = np.asarray(Image.open(src)).astype(np.float32)
L = b[..., :3] @ np.array([.299, .587, .114])
keys = np.array([0, 30, 70, 115, 150, 190, 228, 255], np.float32)
cols = np.array([[6, 3, 2], [30, 12, 6], [105, 45, 16], [178, 86, 36], [208, 108, 49], [232, 140, 80], [250, 190, 145], [255, 228, 205]], np.float32)
rgb = np.stack([np.interp(L, keys, cols[:, c]) for c in range(3)], -1)
# keep a little of the original neutral detail in the darkest parts (lens glass stays glass-like)
k = np.clip((L - 20) / 60, 0, 1)[..., None]
rgb = rgb * k + b[..., :3] * (1 - k) * .9
Image.fromarray(np.dstack([np.clip(rgb, 0, 255), b[..., 3]]).astype(np.uint8)).save(out)
print('ok', b.shape)
