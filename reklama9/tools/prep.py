"""Prepare Apple Cosmic Orange iPhone 17 Pro stills: black-background key → RGBA cut-outs."""
import cv2, numpy as np, sys
D, OUT = sys.argv[1], sys.argv[2]
def key_black(img, thr=14):
    mx = img.max(2).astype(np.float32)
    near = (mx < thr).astype(np.uint8)
    n, lab = cv2.connectedComponents(near, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = (~bg).astype(np.uint8)
    cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    solid = np.zeros_like(fg); cv2.drawContours(solid, [c for c in cnts if cv2.contourArea(c) > 20000], -1, 1, -1)
    soft = np.clip((mx - 4) / 40, 0, 1)
    dist = cv2.distanceTransform(solid, cv2.DIST_L2, 3)
    a = np.where(dist > 3, 1.0, np.maximum(soft, (dist / 3) ** 2)) * solid
    a = cv2.GaussianBlur(a.astype(np.float32), (3, 3), .7) * solid
    ys, xs = np.where(a > .01)
    return np.dstack([img, a * 255])[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.uint8)
cam = cv2.imread(D + 'Apple-iPhone-17-Pro-camera-close-up-250909.jpg')
cv2.imwrite(OUT + 'cam.jpg', cam, [cv2.IMWRITE_JPEG_QUALITY, 93])
pair = key_black(cv2.imread(D + 'Apple-iPhone-17-Pro-cosmic-orange-250909.jpg'))
cv2.imwrite(OUT + 'pair.png', pair); print('pair', pair.shape)
front = key_black(cv2.imread(D + 'Apple-iPhone-17-Pro-iOS-26-Liquid-Glass-Lock-Screen-250909.jpg'))
front = cv2.resize(front, (round(front.shape[1] * 1700 / front.shape[0]), 1700), interpolation=cv2.INTER_AREA)
cv2.imwrite(OUT + 'front.png', front); print('front', front.shape)
