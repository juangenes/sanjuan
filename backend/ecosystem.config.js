module.exports = {
  apps: [{
    name: 'sanjuan-api',
    script: 'src/server.js',
    cwd: '/var/www/sanjuan/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
  }],
};
