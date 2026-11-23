const email = process.env.INITIAL_ADMIN_EMAIL;
const password = process.env.INITIAL_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required');
}

if (password.length < 12) {
  throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters');
}

console.info(
  'Initial account provisioning contract is ready. Persistence is implemented by C-04; no account was created.',
);
