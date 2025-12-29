module.exports = {
  apps: [
    {
      name: 'smartrag-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/seven/work/talor/rag/smartrag/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
