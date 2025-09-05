module.exports = {
  apps: [{
    name: "svelte",
    script: "build/index.js",
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3001,
      POSTGRES_USER: "bastu_admin",
      POSTGRES_PASSWORD: "bastupassword", 
      POSTGRES_DB: "bastudb",
      POSTGRES_HOST: "localhost",
      POSTGRES_PORT: 5433,
    },
    log_file: "logs/combined.log",
    out_file: "logs/out.log",
    error_file: "logs/error.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    merge_logs: true,
    time: true
  }]
};

// Your preferred command:
// PORT=3001 POSTGRES_USER=bastu_admin POSTGRES_PASSWORD=bastupassword POSTGRES_DB=bastudb POSTGRES_HOST=localhost POSTGRES_PORT=5433 pm2 start build/index.js --name "svelte"
//
// Alternative using ecosystem config:
// pm2 start ecosystem.config.js
// pm2 restart ecosystem.config.js
// pm2 stop ecosystem.config.js
// pm2 delete ecosystem.config.js