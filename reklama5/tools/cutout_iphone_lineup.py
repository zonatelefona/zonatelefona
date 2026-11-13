"""Isolate the silver iPhone 17 Pro (front-most) from Apple's colour-lineup still.
Silhouette = rounded rectangle measured from its free (top/right/bottom) edges,
left edge found where the low-saturation silver body starts."""
import sys, numpy as np, cv2
src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src).astype(np.float32)
hsv = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
lum = img.mean(2); sat = hsv[..., 1] / 255
H, W = lum.shape
silver = (lum > 40) & (sat < 0.22)
# right edge: rightmost column with silver at mid-height band
rows = slice(int(H * .45), int(H * .55))
cols_right = np.where(silver[rows].mean(0) > .5)[0]
x1 = cols_right.max() + 1
# left edge: first column (scanning from x1 leftward) where silver stops at mid height
mid = silver[rows].mean(0) > .5
x0 = x1 - 1
while x0 > 0 and mid[x0 - 1]: x0 -= 1
colsil = silver[:, x0 + 40:x1 - 40].mean(1) > .5
ys = np.where(colsil)[0]; y0, y1 = ys.min(), ys.max() + 1
# corner radius from the free top-right corner: how far down the right edge starts
right_profile = [np.where(silver[y, x0:x1])[0].max() + x0 if silver[y, x0:x1].any() else x0 for y in range(y0, y0 + 400)]
right_profile = np.array(right_profile)
r = int(np.argmax(right_profile >= x1 - 2) * 1.05) or 150
mask = np.zeros((H, W), np.uint8)
ss = 4  # supersampled rounded rect for smooth AA
big = np.zeros((H * ss, W * ss), np.uint8)
cv2.rectangle(big, ((x0 + r) * ss, y0 * ss), ((x1 - r) * ss, y1 * ss), 255, -1)
cv2.rectangle(big, (x0 * ss, (y0 + r) * ss), (x1 * ss, (y1 - r) * ss), 255, -1)
for cx, cy in [(x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)]:
    cv2.circle(big, (cx * ss, cy * ss), r * ss, 255, -1)
mask = cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA)
# tighten to real edge on free sides: multiply by soft luminance edge
soft = np.clip((lum - 18) / 30, 0, 1)
alpha = mask / 255.0
edge = (alpha > 0) & (alpha < 1) | (cv2.erode((alpha > .99).astype(np.uint8), np.ones((5, 5))) == 0) & (alpha > 0)
alpha = np.where(edge & (np.arange(W)[None, :] > x0 + 60), alpha * soft, alpha)
out = np.dstack([img, alpha * 255])[y0:y1, x0:x1].astype(np.uint8)
cv2.imwrite(dst, out); print(dst, out.shape, 'radius', r, (x0, y0, x1, y1))
