export const createAuditLogger = ({ pool, uuidv4 }) => {
  return async (userId, action, targetType, targetId, details = {}) => {
    try {
      await pool.query(
        'INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), userId || null, action, targetType || null, targetId || null, details]
      );
    } catch (err) {
      console.error('Failed to log audit', err);
    }
  };
};
