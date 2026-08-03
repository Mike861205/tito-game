// PM2 - Tito Game API (sirve tambien el build del juego)
module.exports = {
  apps: [
    {
      name: 'tito-api',
      cwd: '/var/www/tito/apps/api',
      script: 'dist/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/www/tito/logs/api-out.log',
      error_file: '/var/www/tito/logs/api-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
