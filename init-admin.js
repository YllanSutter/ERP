import pkg from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:postgres123@localhost:5433/erp_db',
});

const createAdminUser = async () => {
  try {
    // Vérifier si l'admin existe déjà
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@erp.local']
    );

    if (existing.rowCount > 0) {
      console.log('✅ Admin user already exists');
      await pool.end();
      return;
    }

    // Créer l'utilisateur admin
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync('admin123', 10);

    await pool.query(
      'INSERT INTO users (id, email, name, password_hash, provider) VALUES ($1, $2, $3, $4, $5)',
      [adminId, 'admin@erp.local', 'Administrator', passwordHash, 'local']
    );

    // Récupérer le rôle admin
    const adminRole = await pool.query(
      'SELECT id FROM roles WHERE name = $1',
      ['admin']
    );

    if (adminRole.rowCount > 0) {
      // Assigner le rôle admin à l'utilisateur
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [adminId, adminRole.rows[0].id]
      );

      console.log('✅ Admin user created successfully');
      console.log('   Email: admin@erp.local');
      console.log('   Password: admin123');
      console.log('   ⚠️  Change this password after first login!');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    await pool.end();
    process.exit(1);
  }
};

createAdminUser();
