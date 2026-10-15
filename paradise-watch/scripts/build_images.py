"""Build web images for every product from the original phone photos.

Usage: python3 -I scripts/build_images.py <photos_dir> <order.txt>
- <photos_dir> holds the original JPGs (<id>-image.jpg)
- <order.txt> lists photo ids in the order they were sent (1-based numbers in photo-map.json)

Outputs (public/assets/img):
  w/<slug>-<n>.webp       full photo, 1200x1600 (same URL scheme as the live site)
  w/<slug>-<n>-600.webp   full photo, 600x800
  card/<slug>-<w>.webp    4:5 crop of photo 1 around the box, 800 and 400 wide
  og/<slug>.jpg           1200x630 crop for link previews
The photos are only resized and cropped; colours and content are untouched.
"""
import json, sys, os
from PIL import Image

src_dir, order_file = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'public', 'assets', 'img')
ids = open(order_file).read().split()
cfg = json.load(open(os.path.join(root, 'scripts', 'photo-map.json')))

def load(n):
    im = Image.open(os.path.join(src_dir, f'{ids[n - 1]}-image.jpg'))
    return im.convert('RGB')

def crop45(im, cx, cy, w):
    W, H = im.size
    cw = w * W
    ch = cw * 1.25
    x0 = min(max(cx * W - cw / 2, 0), W - cw)
    y0 = min(max(cy * H - ch / 2, 0), H - ch)
    return im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))

manifest = {}
for slug, c in cfg.items():
    count = 0
    for k, n in enumerate(c['photos'], start=1):
        im = load(n)
        big = im.resize((1200, 1600), Image.LANCZOS)
        big.save(os.path.join(out, 'w', f'{slug}-{k}.webp'), 'WEBP', quality=80, method=6)
        im.resize((600, 800), Image.LANCZOS).save(os.path.join(out, 'w', f'{slug}-{k}-600.webp'), 'WEBP', quality=78, method=6)
        count += 1
        if k == 1:
            card = crop45(im, *c['crop'])
            for w in (800, 400):
                card.resize((w, round(w * 1.25)), Image.LANCZOS).save(
                    os.path.join(out, 'card', f'{slug}-{w}.webp'), 'WEBP', quality=80 if w == 800 else 76, method=6)
            # 1200x630 link preview centred on the watch
            cx, cy, _ = c['crop']
            y0 = min(max(round(cy * 1600 - 315), 0), 1600 - 630)
            big.crop((0, y0, 1200, y0 + 630)).save(os.path.join(out, 'og', f'{slug}.jpg'), 'JPEG', quality=82, optimize=True, progressive=True)
    manifest[slug] = count
json.dump(manifest, open(os.path.join(root, 'src', 'data', 'image-counts.json'), 'w'), indent=2)
print(json.dumps(manifest))
