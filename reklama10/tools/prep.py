"""Prepare real product assets for 'POV: UŠAO SI SAMO DA POGLEDAŠ…' (official Apple / Samsung press images & footage).
usage: python3 tools/prep.py <refs_dir> <assets_dir>"""
import sys, os, subprocess, numpy as np, cv2
R, A = sys.argv[1], sys.argv[2]
def soft_cut(img, mask, feather=1.6):
    """mask (uint8 0/1) → filled outer silhouette with a feathered edge, cropped to its bbox"""
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    big = max(cnts, key=cv2.contourArea); solid = np.zeros_like(mask); cv2.drawContours(solid, [big], -1, 1, -1)
    a = cv2.GaussianBlur(solid.astype(np.float32), (0, 0), feather)
    a = np.clip((a - .5) * 1.6 + .5, 0, 1) * cv2.dilate(solid, np.ones((3, 3), np.uint8))
    ys, xs = np.where(a > .01); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return np.dstack([img, (a * 255).astype(np.uint8)])[y0:y1, x0:x1]
def key_white(path, thr=246):
    img = cv2.imread(path); mn = img.min(2)
    bgm = (mn >= thr).astype(np.uint8); n, lab = cv2.connectedComponents(bgm, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = (~np.isin(lab, list(border))).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    return soft_cut(img, fg)
def key_dark_on_white(img, thr=150):
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); m = (lum < thr).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((11, 11), np.uint8))          # drop thin lines of the neighbouring phone
    n, lab, st, _ = cv2.connectedComponentsWithStats(m); k = 1 + int(np.argmax(st[1:, 4])); m = (lab == k).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    return soft_cut(img, m)
def save(name, rgba, h=None):
    if h: rgba = cv2.resize(rgba, (round(rgba.shape[1] * h / rgba.shape[0]), h), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(A, name), rgba); print(name, rgba.shape)
S = os.path.join(R, 's26_hi')
save('s26_back.png', key_white(os.path.join(S, '047-galaxy-s26ultra-black-back.jpg')), 1900)
save('s26_back_r30.png', key_white(os.path.join(S, '049-galaxy-s26ultra-black-back-right-30.jpg')), 1900)
save('s26_back_l30.png', key_white(os.path.join(S, '048-galaxy-s26ultra-black-back-left-30.jpg')), 1900)
save('s26_front.png', key_white(os.path.join(S, '044-galaxy-s26ultra-black-front.jpg')), 1900)
lin = cv2.imread(os.path.join(R, 'air/x_color-lineup/Apple-iPhone-Air-color-lineup-250909.jpg'))[:, 2280:]
save('air_black.png', key_dark_on_white(lin), 1900)
cam = cv2.imread(os.path.join(R, 'ip17/Images-of-Apple-iPhone-17-Pro-250909/Apple-iPhone-17-Pro-camera-close-up-250909.jpg'))
cv2.imwrite(os.path.join(A, 'cam.jpg'), cam, [cv2.IMWRITE_JPEG_QUALITY, 92])
for name, src, n in (('pl', 'ip17/Images-of-Apple-iPhone-17-Pro-250909/Apple-iPhone-17-Pro-forged-plateau-250909.mp4', 360),
                     ('ap', 'air/x_plateau/Apple-iPhone-Air-plateau-250909.mp4', 110)):
    d = os.path.join(A, name); os.makedirs(d, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(R, src), '-frames:v', str(n), '-q:v', '3', os.path.join(d, '%04d.jpg')], check=True)
    print(name, len(os.listdir(d)), 'frames')
