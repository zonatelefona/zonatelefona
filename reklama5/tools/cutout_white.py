"""Cut a product out of a pure-white studio background.
usage: python3 cutout_white.py in.jpg out.png"""
import sys, numpy as np, cv2
src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src, cv2.IMREAD_COLOR).astype(np.float32)
h, w = img.shape[:2]
mn = img.min(axis=2)
nearwhite = (mn > 238).astype(np.uint8)
# background = near-white region connected to the image border
n, lab = cv2.connectedComponents(nearwhite, connectivity=4)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
fg = ~bg
# fill holes inside the product (bright reflections fully enclosed)
fgu = fg.astype(np.uint8)
cnts, _ = cv2.findContours(fgu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
solid = np.zeros_like(fgu); cv2.drawContours(solid, [c for c in cnts if cv2.contourArea(c) > 2000], -1, 1, -1)
# soft edge: inside a narrow band, alpha from "distance to white"
dist_in = cv2.distanceTransform(solid, cv2.DIST_L2, 3)
band = (dist_in < 4) & (solid > 0)
soft = np.clip((255 - mn) / (255 - 215), 0, 1)
alpha = solid.astype(np.float32)
alpha[band] = np.maximum(soft[band], np.clip(dist_in[band] / 4, 0, 1) ** 2)
alpha = cv2.GaussianBlur(alpha, (3, 3), 0.6) * (solid > 0)
# decontaminate white fringe
a3 = np.maximum(alpha, 1e-3)[..., None]
col = np.clip((img - (1 - a3) * 255) / a3, 0, 255)
col = np.where(alpha[..., None] > 0.995, img, col)
ys, xs = np.where(alpha > 0.01)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
out = np.dstack([col, alpha * 255])[y0:y1, x0:x1].astype(np.uint8)
cv2.imwrite(dst, out)
print(dst, out.shape)
