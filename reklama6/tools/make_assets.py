"""Scale the product cutouts and bake orange rim-light layers from each alpha channel.
rim_L / rim_R = light wrapping the left / right silhouette edge (Claude orange #F97316 → #D97757)."""
import cv2, numpy as np, sys
CUT, OUT = sys.argv[1], sys.argv[2]
def load(n): return cv2.imread(CUT + n, cv2.IMREAD_UNCHANGED)
def rims(rgba, name, px=7):
    a = rgba[..., 3].astype(np.float32) / 255
    h, w = a.shape
    for side, dx in (('L', px), ('R', -px)):
        sh = np.zeros_like(a)
        if dx > 0: sh[:, dx:] = a[:, :-dx]
        else: sh[:, :dx] = a[:, -dx:]
        edge = np.clip(a - sh, 0, 1)                      # thin lit edge on that side
        core = cv2.GaussianBlur(edge, (0, 0), 1.2) * a     # inside the silhouette
        glow = cv2.GaussianBlur(edge, (0, 0), 14) * 1.6    # spill outside
        al = np.clip(core * 1.4 + glow * .55, 0, 1)
        col = np.zeros((h, w, 3), np.float32)
        col[:] = (22, 115, 249)                            # BGR of #F97316
        hot = np.clip(core * 1.6, 0, 1)[..., None]
        col = col * (1 - hot * .45) + np.array([200, 225, 255], np.float32) * hot * .45   # hot core → warm white
        cv2.imwrite(OUT + f'{name}_rim{side}.png', np.dstack([col, al * 255]).astype(np.uint8))
def scaled(n, out, H):
    im = load(n); s = H / im.shape[0]
    im = cv2.resize(im, (round(im.shape[1] * s), H), interpolation=cv2.INTER_AREA)
    cv2.imwrite(OUT + out + '.png', im); rims(im, out); print(out, im.shape); return s
s = scaled('s26_047.png', 's26_back', 1400)
scaled('s26_048.png', 's26_bl30', round(1452 * 1400 / 1400))
scaled('s26_050.png', 's26_side', 1400)
scaled('s26_045.png', 's26_fl30', 1452)
scaled('s26_044.png', 's26_front', 1400)
pen = load('s26_052.png'); pen = cv2.resize(pen, (round(pen.shape[1] * s), round(pen.shape[0] * s)), interpolation=cv2.INTER_AREA); cv2.imwrite(OUT + 's26_spen.png', pen)
full = load('s26_047.png'); cv2.imwrite(OUT + 's26_back_full.png', full)
ip = load('ip17_back_silver.png'); ip[..., 3] = cv2.erode(ip[..., 3], np.ones((3, 3), np.uint8))
H = round(1400 * 150.0 / 163.6); ip = cv2.resize(ip, (round(ip.shape[1] * H / ip.shape[0]), H), interpolation=cv2.INTER_AREA)
cv2.imwrite(OUT + 'ip17_back.png', ip); rims(ip, 'ip17_back'); print('ip17_back', ip.shape)
