export async function getLicenseByKeyAndEmail(key, email) {
  const licenses = globalThis.__mockLicenses;
  const record = licenses.get(`${email.toLowerCase().trim()}|${key.trim().toUpperCase()}`);
  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    key: record.key,
    activated: record.activated,
    is_suspended: record.is_suspended,
  };
}
