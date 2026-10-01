import crypto from 'crypto';

export const PASSWORD_MASK = '__ERP_PASSWORD_MASK__';
const ENCRYPTED_PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const configured = process.env.FIELD_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!configured) {
    throw new Error('FIELD_ENCRYPTION_KEY doit être configurée pour chiffrer les champs secrets');
  }
  return crypto.createHash('sha256').update(String(configured), 'utf8').digest();
}

export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptSecret(value) {
  if (value === null || value === undefined || value === '') return value ?? '';
  if (isEncryptedSecret(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(value) {
  if (!isEncryptedSecret(value)) return value ?? '';
  const [, version, ivText, tagText, encryptedText] = value.split(':');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
    throw new Error('Valeur secrète chiffrée invalide');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function transformSecretFields(state, transform) {
  if (!state || !Array.isArray(state.collections)) return state;
  return {
    ...state,
    collections: state.collections.map((collection) => {
      const passwordIds = new Set(
        (collection.properties || [])
          .filter((property) => property?.type === 'password')
          .map((property) => property.id)
      );
      if (passwordIds.size === 0) return collection;
      return {
        ...collection,
        items: (collection.items || []).map((item) => {
          const nextItem = { ...item };
          for (const propertyId of passwordIds) {
            if (Object.prototype.hasOwnProperty.call(nextItem, propertyId)) {
              nextItem[propertyId] = transform(nextItem[propertyId]);
            }
          }
          return nextItem;
        }),
      };
    }),
  };
}

export function encryptStateSecrets(state) {
  return transformSecretFields(state, encryptSecret);
}

export function decryptStateSecrets(state) {
  return transformSecretFields(state, decryptSecret);
}

export function maskStateSecrets(state) {
  return transformSecretFields(state, (value) => {
    if (value === null || value === undefined || value === '') return '';
    return PASSWORD_MASK;
  });
}

export function prepareStateForStorage(state, previousState = null) {
  const previous = decryptStateSecrets(previousState);
  const merged = transformSecretFields(state, (value) => {
    if (value === PASSWORD_MASK) return value;
    return value;
  });
  const previousByCollection = new Map((previous?.collections || []).map((collection) => [collection.id, collection]));

  const restored = {
    ...merged,
    collections: (merged.collections || []).map((collection) => {
      const previousCollection = previousByCollection.get(collection.id);
      const previousItems = new Map((previousCollection?.items || []).map((item) => [item.id, item]));
      const passwordIds = new Set(
        (collection.properties || [])
          .filter((property) => property?.type === 'password')
          .map((property) => property.id)
      );
      return {
        ...collection,
        items: (collection.items || []).map((item) => {
          const previousItem = previousItems.get(item.id);
          const nextItem = { ...item };
          for (const propertyId of passwordIds) {
            if (nextItem[propertyId] === PASSWORD_MASK && previousItem) {
              nextItem[propertyId] = previousItem[propertyId] ?? '';
            }
          }
          return nextItem;
        }),
      };
    }),
  };

  return encryptStateSecrets(restored);
}
