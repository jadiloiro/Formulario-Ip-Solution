module.exports = {
  apps: [
    {
      name: 'ipsolution-backend',
      script: 'dist/main.js',
      cwd: '/opt/ipsolution/backend',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      out_file: '/var/log/pm2/ipsolution-backend.out.log',
      error_file: '/var/log/pm2/ipsolution-backend.err.log',
    },
  ],
};
