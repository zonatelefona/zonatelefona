"""Key a dark product out of a light, smooth studio background, frame by frame.
usage: key_video.py in.mp4 start dur out_dir [crop_x crop_w]"""
import sys, os, subprocess, numpy as np, cv2
src, ss, dur, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
cx, cw = (int(sys.argv[5]), int(sys.argv[6])) if len(sys.argv) > 6 else (0, 1920)
os.makedirs(out, exist_ok=True)
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', ss, '-t', dur, '-i', src, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
W, H = 1920, 1080; n = len(raw) // (W * H * 3)
frames = np.frombuffer(raw, np.uint8)[:n * W * H * 3].reshape(n, H, W, 3)
for i, f in enumerate(frames):
    img = f[:, cx:cx + cw].astype(np.float32)
    lum = img.mean(2)
    # smooth background plate: heavy blur of the image with the dark product filled by the border median
    border = np.concatenate([lum[:, :12].ravel(), lum[:, -12:].ravel(), lum[:12].ravel()])
    bgL = np.median(border)
    plate = cv2.GaussianBlur(np.where(lum > bgL - 30, lum, bgL), (0, 0), 25)
    diff = plate - lum
    nearbg = (diff < 14).astype(np.uint8)
    k, lab = cv2.connectedComponents(nearbg, connectivity=4)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge_labels))
    fg = (~bg).astype(np.uint8)
    cnts, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    solid = np.zeros_like(fg); cv2.drawContours(solid, [c for c in cnts if cv2.contourArea(c) > 5000], -1, 1, -1)
    dist = cv2.distanceTransform(solid, cv2.DIST_L2, 3)
    soft = np.clip((diff - 6) / 40, 0, 1)
    a = solid.astype(np.float32)
    band = (dist < 3.5) & (solid > 0)
    a[band] = np.maximum(soft[band], (dist[band] / 3.5) ** 2)
    a = cv2.GaussianBlur(a, (3, 3), .7) * (solid > 0)
    a3 = np.maximum(a, 1e-3)[..., None]
    col = np.where(a[..., None] > .995, img, np.clip((img - (1 - a3) * plate[..., None]) / a3, 0, 255))
    cv2.imwrite(os.path.join(out, f'{i + 1:04d}.png'), np.dstack([col, a * 255]).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 1])
print(out, n, 'frames')
