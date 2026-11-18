// Logo, signature and profile photos. Admins can replace the logo and signature in Settings → Branding.
import defaultLogo from '../assets/logo.png';
import defaultSignature from '../assets/signature.png';

export const logoOf = (S) => (S && S.brand && S.brand.logo) || defaultLogo;
export const signOf = (S) => (S && S.brand && S.brand.signature) || defaultSignature;
export const photoRec = (db, staffId) => (db.records || []).find((r) => r.kind === 'photo' && r.staff_id === staffId);
export const photoOf = (db, staffId) => photoRec(db, staffId)?.data.url || '';

/** Shrink an image file in the browser and return it as a data URL (keeps the database small). */
export function resizeImage(file, max = 320, type = 'image/jpeg', quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('Please choose a photo or image file (JPG or PNG).')); return; }
    if (file.size > 15 * 1024 * 1024) { reject(new Error('That image is too large (over 15 MB).')); return; }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const g = c.getContext('2d'); if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}
/** Square profile photo, cropped to the centre. */
export function squarePhoto(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('Please choose a photo (JPG or PNG).')); return; }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
    img.src = url;
  });
}
/** Save (or replace) an employee's profile photo. */
export function savePhoto(store, db, staffId, url) {
  const rec = photoRec(db, staffId);
  return store.saveRecord(db, rec ? { ...rec, data: { ...rec.data, url } } : { kind: 'photo', staff_id: staffId, data: { url } });
}
